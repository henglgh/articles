---
title: Ceph系统架构-CacheTier中的读写
date: 2021-05-16T14:51:29+0800
description: "本文从ceph源码角度详细讲ceph cache tier机制中缓存层读写逻辑和实现过程。"
tags: [ceph]
---

# 前言
本文从ceph源码角度详细讲ceph cache tier机制中缓存层读写逻辑和实现过程，源码环境如下：
```bash
ceph:           14.2.22
```

&nbsp;
&nbsp;
# PrimaryLogPG::do_request
---
文件路径：`ceph/src/osd/PrimaryLogPG.cc`
OSD在收到客户端发送的请求时，会调用do_request函数，该函数是PrimaryLogPG类的方法。在该函数中，OSD会针对客户端请求类型执行不同操作。在正常情况下，OSD会调用do_op函数来处理客户端的请求。

```cpp
void PrimaryLogPG::do_request(OpRequestRef &op, ThreadPool::TPHandle &handle)
{
    if (op->osd_trace)
    {
        op->pg_trace.init("pg op", &trace_endpoint, &op->osd_trace);
        op->pg_trace.event("do request");
    }
    // make sure we have a new enough map
    //确保请求队列中的请求op是最新的
    auto p = waiting_for_map.find(op->get_source());
    //如果找到op,需要更新请求队列,如果没有找到,说明当前op就是最新的op,不需要入队
    if (p != waiting_for_map.end())
    {
        // preserve ordering
        dout(20) << __func__ << " waiting_for_map " << p->first << " not empty, queueing" << dendl;
        p->second.push_back(op);
        op->mark_delayed("waiting_for_map not empty");
        return;
    }
    if (!have_same_or_newer_map(op->min_epoch))
    {
        dout(20) << __func__ << " min " << op->min_epoch << ", queue on waiting_for_map " << op->get_source() << dendl;
        waiting_for_map[op->get_source()].push_back(op);
        op->mark_delayed("op must wait for map");
        osd->request_osdmap_update(op->min_epoch);
        return;
    }
	//判断当前op是否可以取消,如果是,直接返回
    if (can_discard_request(op))
    {
        return;
    }

    // pg-wide backoffs
    const Message *m = op->get_req();//构建Messaged对象指针
    int msg_type = m->get_type();//获取消息类型

    if (m->get_connection()->has_feature(CEPH_FEATURE_RADOS_BACKOFF))
    {
        SessionRef session{static_cast<Session *>(m->get_connection()->get_priv().get())};
        if (!session)
            return; // drop it.

        if (msg_type == CEPH_MSG_OSD_OP)
        {
            if (session->check_backoff(cct, info.pgid, info.pgid.pgid.get_hobj_start(), m))
            {
                return;
            }

            bool backoff = is_down() || is_incomplete() || (!is_active() && is_peered());
            if (g_conf()->osd_backoff_on_peering && !backoff)
            {
                if (is_peering())
                {
                    backoff = true;
                }
            }
            if (backoff)
            {
                add_pg_backoff(session);
                return;
            }
        }
        // pg backoff acks at pg-level
        if (msg_type == CEPH_MSG_OSD_BACKOFF)
        {
            const MOSDBackoff *ba = static_cast<const MOSDBackoff *>(m);
            if (ba->begin != ba->end)
            {
                handle_backoff(op);
                return;
            }
        }
    }

	//检查PG的状态,如果当前PG处于peering,需要等待
    if (!is_peered())
    {
        // Delay unless PGBackend says it's ok
        //判断PG后端在inactive状态下是否可以处理op,如果可以,就调用pgbackend->handle_message处理
        if (pgbackend->can_handle_while_inactive(op))
        {
            bool handled = pgbackend->handle_message(op);
            ceph_assert(handled);
            return;
        }
        else
        {//如果不可以,需要将当前op挂到waiting_for_peered队列中
            waiting_for_peered.push_back(op);
            op->mark_delayed("waiting for peered");
            return;
        }
    }

	//如果正在flush,需要将当前op挂到waiting_for_flush队列中
    if (flushes_in_progress > 0)
    {
        dout(20) << flushes_in_progress << " flushes_in_progress pending "
                 << "waiting for flush on " << op << dendl;
        waiting_for_flush.push_back(op);
        op->mark_delayed("waiting for flush");
        return;
    }

    ceph_assert(is_peered() && flushes_in_progress == 0);

	//如果PG后端在处理当前op,直接返回
    if (pgbackend->handle_message(op))
        return;

	//如果PG后端没有处理当前op,根据消息类型,执行相关操作
    switch (msg_type)
    {
    case CEPH_MSG_OSD_OP:
    case CEPH_MSG_OSD_BACKOFF:
        if (!is_active())
        {
        	//如果当前PG处于非active状态,需要挂起op到waiting_for_active队列中
            dout(20) << " peered, not active, waiting for active on " << op << dendl;
            waiting_for_active.push_back(op);
            op->mark_delayed("waiting for active");
            return;
        }
		//如果当前PG处于正常状态
        switch (msg_type)
        {
        case CEPH_MSG_OSD_OP:
            // verify client features
            if ((pool.info.has_tiers() || pool.info.is_tier()) && !op->has_feature(CEPH_FEATURE_OSD_CACHEPOOL))
            {
            	//如果是关于分层存储的请求，直接返回
                osd->reply_op_error(op, -EOPNOTSUPP);
                return;
            }
            do_op(op);//处理当前op
            break;
        case CEPH_MSG_OSD_BACKOFF:
            // object-level backoff acks handled in osdop context
            handle_backoff(op);
            break;
        }
        break;

    case MSG_OSD_PG_SCAN:
        do_scan(op, handle);
        break;

    case MSG_OSD_PG_BACKFILL:
        do_backfill(op);
        break;

    case MSG_OSD_PG_BACKFILL_REMOVE:
        do_backfill_remove(op);
        break;

    case MSG_OSD_SCRUB_RESERVE: {
        const MOSDScrubReserve *m = static_cast<const MOSDScrubReserve *>(op->get_req());
        switch (m->type)
        {
        case MOSDScrubReserve::REQUEST:
            handle_scrub_reserve_request(op);
            break;
        case MOSDScrubReserve::GRANT:
            handle_scrub_reserve_grant(op, m->from);
            break;
        case MOSDScrubReserve::REJECT:
            handle_scrub_reserve_reject(op, m->from);
            break;
        case MOSDScrubReserve::RELEASE:
            handle_scrub_reserve_release(op);
            break;
        }
    }
    break;

    case MSG_OSD_REP_SCRUB:
        replica_scrub(op, handle);
        break;

    case MSG_OSD_REP_SCRUBMAP:
        do_replica_scrub_map(op);
        break;

    case MSG_OSD_PG_UPDATE_LOG_MISSING:
        do_update_log_missing(op);
        break;

    case MSG_OSD_PG_UPDATE_LOG_MISSING_REPLY:
        do_update_log_missing_reply(op);
        break;

    default:
        ceph_abort_msg("bad message type in do_request");
    }
}
```
&nbsp;
&nbsp;
# PrimaryLogPG::do_op
---
文件路径：`ceph/src/osd/PrimaryLogPG.cc`
do_op函数是PrimaryLogPG类的方法，该函数是OSD处理请求的通用函数。在处理cache tier时，主要通过调用agent_choose_mode和maybe_handle_cache 函数。其中agent_choose_mode是用来计算cache pool的flush mode和evict mode，并触发cache pool的flush和evict操作。maybe_handle_cache是用来处理代理读写以及是否要将读写的数据promote到cache pool中。

```cpp
void PrimaryLogPG::do_op(OpRequestRef &op)
{
...
...
    //hit set相关设置
    bool in_hit_set = false;
    if (hit_set)
    {
        if (obc.get())
        {
            if (obc->obs.oi.soid != hobject_t() && hit_set->contains(obc->obs.oi.soid))
                in_hit_set = true;
        }
        else
        {
            if (missing_oid != hobject_t() && hit_set->contains(missing_oid))
                in_hit_set = true;
        }
        if (!op->hitset_inserted)
        {
            hit_set->insert(oid);
            op->hitset_inserted = true;
            if (hit_set->is_full() || hit_set_start_stamp + pool.info.hit_set_period <= m->get_recv_stamp())
            {
                hit_set_persist();
            }
        }
    }

    //cache tier agent相关处理
    if (agent_state)
    {
        if (agent_choose_mode(false, op))
            return;
    }

    if (obc.get() && obc->obs.exists && obc->obs.oi.has_manifest())
    {
        if (maybe_handle_manifest(op, write_ordered, obc))
            return;
    }

    //cache tier 处理,如果cache pool 命中 object,则无需处理
    //如果 cache pool 没有命中，则需要根据 cache tier 策略读写数据
    if (maybe_handle_cache(op, write_ordered, obc, r, missing_oid, false, in_hit_set))
        return;

    //cache tier 处理结果
    if (r && (r != -ENOENT || !obc))
    {
        // copy the reqids for copy get on ENOENT
        if (r == -ENOENT && (m->ops[0].op.op == CEPH_OSD_OP_COPY_GET))
        {
            fill_in_copy_get_noent(op, oid, m->ops[0]);
            return;
        }
        dout(20) << __func__ << ": find_object_context got error " << r << dendl;
        if (op->may_write() && get_osdmap()->require_osd_release >= CEPH_RELEASE_KRAKEN)
        {
            record_write_error(op, oid, nullptr, r);
        }
        else
        {
            osd->reply_op_error(op, r);
        }
        return;
    }
...
...
}
```
&nbsp;
&nbsp;
# PrimaryLogPG::maybe_handle_cache
---
文件路径：`ceph/src/osd/PrimaryLogPG.cc`
maybe_handle_cache是PrimaryLogPG类的方法，实际上该函数并不是处理缓存读写数据的真正函数，它只是一个接口。它通过调用maybe_handle_cache_detail函数来实现具体的操作。

```cpp
    bool maybe_handle_cache(OpRequestRef op, bool write_ordered, ObjectContextRef obc, int r,
                            const hobject_t &missing_oid, bool must_promote, bool in_hit_set = false)
    {
        // 如果返回值是cache_result_t::NOOP,说明对 cache tier 没有任何处理
        return cache_result_t::NOOP !=
               maybe_handle_cache_detail(op, write_ordered, obc, r, missing_oid, must_promote, in_hit_set, nullptr);
    }
```
&nbsp;
&nbsp;
# PrimaryLogPG::cache_result_t PrimaryLogPG::maybe_handle_cache_detail
---
文件路径：`ceph/src/osd/PrimaryLogPG.cc`
maybe_handle_cache_detail是PrimaryLogPG类的方法，在该函数是处理cache tier的真正入口函数。在该函数中，会提前检测要读写的object是否在当前OSD的本地中存在，如果有，就不需要对cache tier做任何操作。如果没有，则会根据cache tier策略执行代理读写。同时也会根据promote策略决定是否需要将读写的数据promote到cache pool中。
**注：我在调试代码的时候，发现writeback模式下的新写流程和官网说的不一致。官网在描述writeback模式下，数据先写入到cache pool中，然后由cache pool中flush到base pool中。实际上调试和读源码发现，源码是先将数据写入到base pool中，然后在由base pool中promote到cache pool中，与官网说的截然相反。**

```cpp
PrimaryLogPG::cache_result_t PrimaryLogPG::maybe_handle_cache_detail(OpRequestRef op, bool write_ordered,
                                                                     ObjectContextRef obc, int r, hobject_t missing_oid,
                                                                     bool must_promote, bool in_hit_set,
                                                                     ObjectContextRef *promote_obc)
{
    //检测请求是否需要从 cache pool 中读取数据
    if (op && op->get_req() && op->get_req()->get_type() == CEPH_MSG_OSD_OP &&
        (static_cast<const MOSDOp *>(op->get_req())->get_flags() & CEPH_OSD_FLAG_IGNORE_CACHE))
    {
        dout(20) << __func__ << ": ignoring cache due to flag" << dendl;
        return cache_result_t::NOOP;
    }

	//函数走到这里，说明请求中需要从 cache pool 中读写数据，下一步需要检查有没有设置 cache tier
	
    //检测是否根据 cache tier 有没有正确设置
    //这里的pool不分data pool还是cache pool,因为osd可能在data pool,也可能在cache pool
    // return quickly if caching is not enabled
    if (pool.info.cache_mode == pg_pool_t::CACHEMODE_NONE)
        return cache_result_t::NOOP;

    // promote标志
    must_promote = must_promote || op->need_promote();

    if (obc)
        dout(25) << __func__ << " " << obc->obs.oi << " " << (obc->obs.exists ? "exists" : "DNE") << " missing_oid "
                 << missing_oid << " must_promote " << (int)must_promote << " in_hit_set " << (int)in_hit_set << dendl;
    else
        dout(25) << __func__ << " (no obc)"
                 << " missing_oid " << missing_oid << " must_promote " << (int)must_promote << " in_hit_set "
                 << (int)in_hit_set << dendl;

	// 函数执行到这里，说明当前 OSD 一定是 cache pool 中的 OSD,此时的 pool 一定是 cache pool

    // 根据 object 上下文检测当前 object 是否处于 blocked 状态,如果是,则需要等待
    // if it is write-ordered and blocked, stop now
    if (obc.get() && obc->is_blocked() && write_ordered)
    {
        // we're already doing something with this object
        dout(20) << __func__ << " blocked on " << obc->obs.oi.soid << dendl;
        return cache_result_t::NOOP;
    }

    //检测当前object是否被标记为从集群中删除,如果是,就不能对当前object操作
    //这里的删除指的是逻辑上的删除,真正的删除操作会由定时任务去完成
    if (r == -ENOENT && missing_oid == hobject_t())
    {
        // we know this object is logically absent (e.g., an undefined clone)
        return cache_result_t::NOOP;
    }

    //检测当前 object 是否在已经在当前 OSD 本地中存在，也就是是否在 cache pool 中
    //如果已经命中,就不需要对 cache tier 做任何处理
    if (obc.get() && obc->obs.exists)
    {
        osd->logger->inc(l_osd_op_cache_hit);
        return cache_result_t::NOOP;
    }

    //如果当前 OSD 不是 primary OSD,则需要将请求转发给 primary OSD 处理
    //从另外一方面可以证明此时的 object 很有可能是副本
    if (!is_primary())
    {
        dout(20) << __func__ << " cache miss; ask the primary" << dendl;
        osd->reply_op_error(op, -EAGAIN);//将错误码 `-EAGAIN` 作为响应返回给客户端
        return cache_result_t::REPLIED_WITH_EAGAIN;
    }

    //如果当前 object 被标记为从集群中删除,但是当前 object 的上下文依然存在
    //说明当前 object 实际上并未真正的从集群中删除掉
    //对于这种状态的 object,依然是可以读的
    if (missing_oid == hobject_t() && obc.get())
    {
        missing_oid = obc->obs.oi.soid;
    }

    //走到这里,说明当前 OSD(cache pool) 中确实不存在当前 object

    const MOSDOp *m = static_cast<const MOSDOp *>(op->get_req());

    //获取当前 object 在集群中的存储位置相关信息
    const object_locator_t oloc = m->get_object_locator();

    //检测请求是不是需要跳过处理缓存,如果需要跳过,就不需要处理缓存
    if (op->need_skip_handle_cache())
    {
        return cache_result_t::NOOP;
    }

    OpRequestRef promote_op;

    //下面是处理 cache tier 的逻辑,如果设置了 cache tier, 将根据 cache tier 策略读取数据
    switch (pool.info.cache_mode)
    {
    //writeback模式
    case pg_pool_t::CACHEMODE_WRITEBACK:
        //如果 cache pool 已经处理 full 状态,此时的请求只能读
        if (agent_state && agent_state->evict_mode == TierAgentState::EVICT_MODE_FULL)
        {
            //如果当前请求不是write,也不是将当前请求缓存起来,说明当前请求可能是read
            //如果当前请求是read,则执行代理读
            if (!op->may_write() && !op->may_cache() && !write_ordered && !must_promote)
            {
                dout(20) << __func__ << " cache pool full, proxying read" << dendl;
                do_proxy_read(op);//代理读
                return cache_result_t::HANDLED_PROXY;
            }

            //走到这里,说明当前请求不是read,可能是write,需要将当前请求加入请求等待队列中
            dout(20) << __func__ << " cache pool full, waiting" << dendl;
            block_write_on_full_cache(missing_oid, op);
            return cache_result_t::BLOCKED_FULL;
        }

        //走到这里,说明cache pool不是处于full状态,可以执行write或者read

        //如果当前object需要promote到当前 cache pool 中
        //或者当前osd内存缓存中没有命中当前object
        //需要将当前object promote到 cache pool,并阻塞当前请求,直到当前object被promote到 cache pool中
        if (must_promote || (!hit_set && !op->need_skip_promote()))
        {
            promote_object(obc, missing_oid, oloc, op, promote_obc);
            return cache_result_t::BLOCKED_PROMOTE;
        }

        //走到这里,说明没有执行promote操作

        // 处理write请求
        if (op->may_write() || op->may_cache())
        {
            // 执行代理写
            do_proxy_write(op);

            // Promote too?
            //是否要将写入的数据 promote 到 cache pool 中
            if (!op->need_skip_promote() &&
                maybe_promote(obc, missing_oid, oloc, in_hit_set, pool.info.min_write_recency_for_promote,
                              OpRequestRef(), promote_obc))
            {
                return cache_result_t::BLOCKED_PROMOTE;
            }
            return cache_result_t::HANDLED_PROXY;
        }
        // 处理read请求
        else
        {
            //执行代理读
            do_proxy_read(op);

            // Avoid duplicate promotion
            if (obc.get() && obc->is_blocked())
            {
                if (promote_obc)
                    *promote_obc = obc;
                return cache_result_t::BLOCKED_PROMOTE;
            }

            // Promote too?
            if (!op->need_skip_promote())
            {
                (void)maybe_promote(obc, missing_oid, oloc, in_hit_set, pool.info.min_read_recency_for_promote,
                                    promote_op, promote_obc);
            }

            return cache_result_t::HANDLED_PROXY;
        }

        //走到这里,说明没有处理任何请求
        ceph_abort_msg("unreachable");
        return cache_result_t::NOOP;

    //forward模式
    case pg_pool_t::CACHEMODE_FORWARD:
        // FIXME: this mode allows requests to be reordered.
        do_cache_redirect(op);
        return cache_result_t::HANDLED_REDIRECT;

    //readonly模式
    case pg_pool_t::CACHEMODE_READONLY:
        // TODO: clean this case up
        if (!obc.get() && r == -ENOENT)
        {
            // we don't have the object and op's a read
            promote_object(obc, missing_oid, oloc, op, promote_obc);
            return cache_result_t::BLOCKED_PROMOTE;
        }
        if (!r)
        { // it must be a write
            do_cache_redirect(op);
            return cache_result_t::HANDLED_REDIRECT;
        }
        // crap, there was a failure of some kind
        return cache_result_t::NOOP;

    //readforward模式
    case pg_pool_t::CACHEMODE_READFORWARD:
        // Do writeback to the cache tier for writes
        if (op->may_write() || write_ordered || must_promote)
        {
            if (agent_state && agent_state->evict_mode == TierAgentState::EVICT_MODE_FULL)
            {
                dout(20) << __func__ << " cache pool full, waiting" << dendl;
                block_write_on_full_cache(missing_oid, op);
                return cache_result_t::BLOCKED_FULL;
            }
            promote_object(obc, missing_oid, oloc, op, promote_obc);
            return cache_result_t::BLOCKED_PROMOTE;
        }

        // If it is a read, we can read, we need to forward it
        do_cache_redirect(op);
        return cache_result_t::HANDLED_REDIRECT;

    //proxy模式
    case pg_pool_t::CACHEMODE_PROXY:
        if (!must_promote)
        {
            if (op->may_write() || op->may_cache() || write_ordered)
            {
                do_proxy_write(op);
                return cache_result_t::HANDLED_PROXY;
            }
            else
            {
                do_proxy_read(op);
                return cache_result_t::HANDLED_PROXY;
            }
        }
        // ugh, we're forced to promote.
        if (agent_state && agent_state->evict_mode == TierAgentState::EVICT_MODE_FULL)
        {
            dout(20) << __func__ << " cache pool full, waiting" << dendl;
            block_write_on_full_cache(missing_oid, op);
            return cache_result_t::BLOCKED_FULL;
        }
        promote_object(obc, missing_oid, oloc, op, promote_obc);
        return cache_result_t::BLOCKED_PROMOTE;

    //readproxy模式
    case pg_pool_t::CACHEMODE_READPROXY:
        // Do writeback to the cache tier for writes
        if (op->may_write() || write_ordered || must_promote)
        {
            if (agent_state && agent_state->evict_mode == TierAgentState::EVICT_MODE_FULL)
            {
                dout(20) << __func__ << " cache pool full, waiting" << dendl;
                block_write_on_full_cache(missing_oid, op);
                return cache_result_t::BLOCKED_FULL;
            }
            promote_object(obc, missing_oid, oloc, op, promote_obc);
            return cache_result_t::BLOCKED_PROMOTE;
        }

        // If it is a read, we can read, we need to proxy it
        do_proxy_read(op);
        return cache_result_t::HANDLED_PROXY;

    default:
        ceph_abort_msg("unrecognized cache_mode");
    }

    // 走到这里, 说明cache tier模式没有正确设置,导致对cache tier没有任何操作处理
    return cache_result_t::NOOP;
}
```
&nbsp;
&nbsp;
# PrimaryLogPG::promote_object
---
文件路径： `ceph/src/osd/PrimaryLogPG.cc`

```cpp
void PrimaryLogPG::promote_object(ObjectContextRef obc, const hobject_t &missing_oid, const object_locator_t &oloc,
                                  OpRequestRef op, ObjectContextRef *promote_obc)
{
    hobject_t hoid = obc ? obc->obs.oi.soid : missing_oid;
    ceph_assert(hoid != hobject_t());

    //Scrub是Ceph中的一项数据完整性检查工作,会检查存储池中所有对象的数据是否正确.
    //如果某个对象正在进行Scrub操作,那么对该对象的读写请求就会被阻塞,直到Scrub完成为止.
    //检查对象是否被Scrub阻塞,如果是,则将操作请求放入等待队列中,等待Scrub完成后再处理.
    if (write_blocked_by_scrub(hoid))
    {
        dout(10) << __func__ << " " << hoid << " blocked by scrub" << dendl;
        if (op)
        {
            waiting_for_scrub.push_back(op);//将操作请求放入等待队列中
            op->mark_delayed("waiting for scrub");
            dout(10) << __func__ << " " << hoid << " placing op in waiting_for_scrub" << dendl;
        }
        else
        {
            dout(10) << __func__ << " " << hoid << " no op, dropping on the floor" << dendl;
        }
        return;
    }

    //创建对象上下文,该操作是针对 cache pool 中不存在的对象
    if (!obc)
    { // we need to create an ObjectContext
        ceph_assert(missing_oid != hobject_t());
        obc = get_object_context(missing_oid, true);
    }

    // 是否需要promote obc
    if (promote_obc)
        *promote_obc = obc;

    /*
     * Before promote complete, if there are  proxy-reads for the object,
     * for this case we don't use DONTNEED.
     */
    //设置对象数据的读取策略
    unsigned src_fadvise_flags = LIBRADOS_OP_FLAG_FADVISE_SEQUENTIAL;
    map<hobject_t, list<OpRequestRef>>::iterator q = in_progress_proxy_ops.find(obc->obs.oi.soid);
    if (q == in_progress_proxy_ops.end())
    {
        src_fadvise_flags |= LIBRADOS_OP_FLAG_FADVISE_DONTNEED;
    }

    CopyCallback *cb;
    object_locator_t my_oloc;
    hobject_t src_hoid;

    //下面是创建promote结束后的回调函数
    //回调函数在start_copy函数执行完成后被调用
    //如果对象全部位于同一个OSD上
    if (!obc->obs.oi.has_manifest())
    {
        my_oloc = oloc;
        my_oloc.pool = pool.info.tier_of;//获取 base pool
        src_hoid = obc->obs.oi.soid;//表示复制操作的源对象ID
        cb = new PromoteCallback(obc, this);
    }
    else
    {//如果对象被分解成多块,分散到其他OSD中
        if (obc->obs.oi.manifest.is_chunked())
        {
            src_hoid = obc->obs.oi.soid;
            cb = new PromoteManifestCallback(obc, this);
        }
        else if (obc->obs.oi.manifest.is_redirect())
        {
            object_locator_t src_oloc(obc->obs.oi.manifest.redirect_target);
            my_oloc = src_oloc;
            src_hoid = obc->obs.oi.manifest.redirect_target;
            cb = new PromoteCallback(obc, this);
        }
        else
        {
            ceph_abort_msg("unrecognized manifest type");
        }
    }

    unsigned flags = CEPH_OSD_COPY_FROM_FLAG_IGNORE_OVERLAY | CEPH_OSD_COPY_FROM_FLAG_IGNORE_CACHE |
                     CEPH_OSD_COPY_FROM_FLAG_MAP_SNAP_CLONE | CEPH_OSD_COPY_FROM_FLAG_RWORDERED;
    //执行复制操作
    start_copy(cb, obc, src_hoid, my_oloc, 0, flags, obc->obs.oi.soid.snap == CEPH_NOSNAP, src_fadvise_flags, 0);

    //确保对象已经被blocked,防止被其他操作使用
    ceph_assert(obc->is_blocked());
    //在 promote_object() 函数中,需要对对象进行数据复制和版本更新等操作,这些操作可能会影响对象的状态.
    //为了避免在操作期间出现未预期的错误,需要将 obc 对象标记为 blocked 状态,以防止其他操作同时修改对象
    //如果对象已经被标记为 blocked 状态,则函数立即返回:否则,函数会一直等待
    if (op)
        wait_for_blocked_object(obc->obs.oi.soid, op);

    info.stats.stats.sum.num_promote++;
}
```


**由于时间问题，文档还在努力的完善中....**
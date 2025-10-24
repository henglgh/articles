---
title: DAOS系统架构-fuse层inode与daos层object的关系
date: 2025-10-24T09:00:00+0800
description: "本文详细介绍DAOS.2.6.0中fuse层inode与daos层object的关系"
tags: [daos]
---

# 1. 概述
当在客户端执行`ls`操作时，这条命令会列出待查看目录下的所有子项的信息（也就是文件系统中所谓的元数据信息），比如文件名、文件大小、文件类型、文件权限、文件所有者、文件创建时间等。在DAOS中，目录子项的元数据信息以多层级key-value形式存储在父目录的object中。`ls`命令的执行过程中，会先获取父目录的object，然后从父目录object中解析出目录子项的元数据信息，最后将这些信息展示给用户。这一过程中会涉及到：`dfuse_inode_entry`、`dfs_obj`、`dc_object`这些数据结构，那么他们之间到底是什么样的关系呢？用户态程序是如何从dfuse_inode_entry结构摸索到dc_object？本文将从lookup操作的角度来理清他们之间的关系。

&nbsp;
&nbsp;
# 2. 数据结构
上述所说的`ls`操作，在DAOS中是一个lookup操作，以dfuse层dfuse_cb_lookup函数为入口。整个I/O逻辑思路大概是2个阶段，第1阶段以父目录dfuse inode为起点，经过层层转换，找到父目录dfuse inode对应的DAOS对象，一旦找到了DAOS对象，就可以从DAOS对象中读取子项的元数据信息。

![parent inode](/static/images/pinode.png)

如上图所示，dfuse inode数据结构的操作最终会转化成对dc object的操作，中间以dfs object为过渡。在这一过程中，最关键的元素是oh（object open handle），oh是dfs object数据结构中的成员，而整个dfs object数据结构被封装到dfuse inode中。从dfuse inode找到关联的dc object，实际上就是从dfs object找到对应dc object。因此oh成为这一环节的关键元素。为了实现这一过程，DAOS提供`obj_hdl2ptr`函数。obj_hdl2ptr函数会根据传入的oh参数，在内存中找到对应的dc objec的内存地址。内存中dc object通过哈希表管理的，此处不再展开细说。

```c
struct dc_object * obj_hdl2ptr(daos_handle_t oh) {
  struct d_hlink *hlink;

  hlink = daos_hhash_link_lookup(oh.cookie);
  if (hlink == NULL)
      return NULL;

  return container_of(hlink, struct dc_object, cob_hlink);
}
```
有了oh和dc object这层逻辑关系，就可以顺理成章的从父目录的object中读取子项的元数据信息，`fetch_entry`函数是关键入口函数。该函数最主要的传入输入参数是：父目录的oh，目录子项的名字name以及目录子项的dfs entry。在`fetch_entry`函数中，会将dfs entry中的每一项元数据成员封装到内存管理结构sg_iovs中，并插入到内存管理结构列表sgl中。然后以目录子项的名字name为key，sgl为value，调用`daos_obj_fetch`从父目录对象中读取并解析出子项的元数据信息。

```c
fetch_entry (...) {
  ...
  d_iov_set(&dkey, (void *)name, len);
  d_iov_set(&iod->iod_name, INODE_AKEY_NAME, sizeof(INODE_AKEY_NAME) - 1);
  ...
  d_iov_set(&sg_iovs[i++], &entry->mode, sizeof(mode_t));
  d_iov_set(&sg_iovs[i++], &entry->oid, sizeof(daos_obj_id_t));
  d_iov_set(&sg_iovs[i++], &entry->mtime, sizeof(uint64_t));
  d_iov_set(&sg_iovs[i++], &entry->ctime, sizeof(uint64_t));
  d_iov_set(&sg_iovs[i++], &entry->chunk_size, sizeof(daos_size_t));
  d_iov_set(&sg_iovs[i++], &entry->oclass, sizeof(daos_oclass_id_t));
  d_iov_set(&sg_iovs[i++], &entry->mtime_nano, sizeof(uint64_t));
  d_iov_set(&sg_iovs[i++], &entry->ctime_nano, sizeof(uint64_t));
  d_iov_set(&sg_iovs[i++], &entry->uid, sizeof(uid_t));
  d_iov_set(&sg_iovs[i++], &entry->gid, sizeof(gid_t));
  d_iov_set(&sg_iovs[i++], &entry->value_len, sizeof(daos_size_t));
  d_iov_set(&sg_iovs[i++], &entry->obj_hlc, sizeof(uint64_t));
  ...
  rc = daos_obj_fetch(oh, th, DAOS_COND_DKEY_FETCH, &dkey, xnr + 1, iods ? iods : iod,
          sgls ? sgls : sgl, NULL, NULL);
}
```
第2阶段是构建目录子项的dfs object并补全完整的目录子项dfuse inode结构。因为在整个lookup操作流程的最后，是以dfuse_reply_entry方式回复给客户端，而dfuse_reply_entry函数会将完整的目录子项dfuse inode返回。关键处理逻辑在`lookup_rel_int`函数中。

![child inode](/static/images/cinode.png)

第2阶段的重点是补全目录子项的dfs object。从上图`dfs_obj`结构可以看到，成员oid可以从第1阶段的目录子项的dfs entry中获取到，成员parent_oid可以直接从父目录的dfs object中获取到，唯独oh没有现成的。因此，在`lookup_rel_int`函数中，会调用`daos_obj_open`函数来获取oh。daos_obj_open函数之所以能正确获取目录子项的oh，是因为其传入参数之一是目录子项对象的oid，oid在第1阶段已经获取到了。

```c
lookup_rel_int (...) {
  ...
  # 第1阶段
  rc = fetch_entry(dfs->layout_v, parent->oh, DAOS_TX_NONE, name, len, true, &exists, &entry,
    xnr, xnames, xvals, xsizes);
  ...
  # 第2阶段
  case S_IFDIR:
    rc = daos_obj_open(dfs->coh, entry.oid, daos_mode, &obj->oh, NULL);
  ...
}
```
最后，也就是之前说的，最终以dfuse_reply_entry方式结束。

```bash
dfuse_cb_lookup(fuse_req_t req, struct dfuse_inode_entry *parent,
  const char *name) {
    ...
    rc = dfs_lookupx(parent->ie_dfs->dfs_ns, parent->ie_obj, name,
      O_RDWR | O_NOFOLLOW, &ie->ie_obj, NULL, &ie->ie_stat,
      1, &duns_xattr_name, (void **)&outp, &attr_len);
     ...
    dfuse_reply_entry(dfuse_info, ie, NULL, false, req);
    ...
}
```
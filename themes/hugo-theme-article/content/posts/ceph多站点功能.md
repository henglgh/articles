---
title: ceph多站点功能
date: 2024-12-09T14:48:54+0800
description: "本文详细介绍如何搭建ceph多站点，以及如何使用多站点功能。"
tags: [ceph]
---


# 1. 前言
本文详细介绍如何搭建ceph多站点功能。系统环境如下：
```bash
ceph:           14.2.22
```
多站点是Ceph对象存储的一个功能，它是在两个独立的集群（主集群和备集群）之间实现数据同步功能。在Ceph14.2.22版本中两个集群都可以接受读写请求，但是second集群无法直接处理写请求，而是将写请求转发到master集群中处理。second集群无法创建bucket，只能操作object。两个集群之间的数据同步包括元数据和数据的同步。

&nbsp;
&nbsp;
# 2. 集群规划
```bash
master 集群        192.168.3.12        node1
second 集群        192.168.3.13        node2
```

&nbsp;
&nbsp;
# 3. Master集群配置
### 3.1. 创建realm并设置为default
```bash
radosgw-admin realm create --rgw-realm=movies --default
-----------------------------------------------------------------------------------------------------------------------
{
    "id": "821d976e-be24-48ef-aeb0-a9882085e7fb",
    "name": "movies",
    "current_period": "dec345b1-dfee-4cec-832e-2d3797ad7012",
    "epoch": 1
}
```
其中`--rgw-realm`的值为rgw realm的名字，`--default`表示将movies设置为多站点中默认的rgw realm，该命令将会创建名为movies的rgw realm，并将movies设置为默认的rgw realm。

### 3.2. 创建master zonegroup并设置为default
`radosgw-admin zonegroup create --rgw-realm={realm name} --rgw-zonegroup={zonegroup name} --endpoints={url} --master --default`
```bash
radosgw-admin zonegroup create --rgw-realm=movies --rgw-zonegroup=us --endpoints=http://192.168.3.12:7480 --master --default
-----------------------------------------------------------------------------------------------------------------------
{
    "id": "09143c33-a26f-449a-94c9-11c41ce79ac9",
    "name": "us",
    "api_name": "us",
    "is_master": "true",
    "endpoints": [
        "http://192.168.3.12:7480"
    ],
    "hostnames": [],
    "hostnames_s3website": [],
    "master_zone": "",
    "zones": [],
    "placement_targets": [],
    "default_placement": "",
    "realm_id": "821d976e-be24-48ef-aeb0-a9882085e7fb"
}
```

### 3.3. 创建master zone并设置为default
`radosgw-admin zone create --rgw-zonegroup={zonegroup name} --rgw-zone={zone name} --endpoints={url} --master --default`
```bash
radosgw-admin zone create --rgw-zonegroup=us --rgw-zone=us-east --endpoints=http://192.168.3.12:7480 --master --default
-----------------------------------------------------------------------------------------------------------------------
{
    "id": "b711f710-37c1-4532-984b-5073c052be28",
    "name": "us-east",
    "domain_root": "us-east.rgw.meta:root",
    "control_pool": "us-east.rgw.control",
    "gc_pool": "us-east.rgw.log:gc",
    "lc_pool": "us-east.rgw.log:lc",
    "log_pool": "us-east.rgw.log",
    "intent_log_pool": "us-east.rgw.log:intent",
    "usage_log_pool": "us-east.rgw.log:usage",
    "reshard_pool": "us-east.rgw.log:reshard",
    "user_keys_pool": "us-east.rgw.meta:users.keys",
    "user_email_pool": "us-east.rgw.meta:users.email",
    "user_swift_pool": "us-east.rgw.meta:users.swift",
    "user_uid_pool": "us-east.rgw.meta:users.uid",
    "otp_pool": "us-east.rgw.otp",
    "system_key": {
        "access_key": "",
        "secret_key": ""
    },
    "placement_pools": [
        {
            "key": "default-placement",
            "val": {
                "index_pool": "us-east.rgw.buckets.index",
                "storage_classes": {
                    "STANDARD": {
                        "data_pool": "us-east.rgw.buckets.data"
                    }
                },
                "data_extra_pool": "us-east.rgw.buckets.non-ec",
                "index_type": 0
            }
        }
    ],
    "metadata_heap": "",
    "realm_id": "821d976e-be24-48ef-aeb0-a9882085e7fb"
}
```

### 3.4. 创建system用户
`radosgw-admin user create --uid={user name} --display-name={user name} --system`
```bash
radosgw-admin user create --uid="muti-site" --display-name="muti-site" --system
-----------------------------------------------------------------------------------------------------------------------
{
    "user_id": "muti-site",
    "display_name": "muti-site",
    "email": "",
    "suspended": 0,
    "max_buckets": 1000,
    "subusers": [],
    "keys": [
        {
            "user": "muti-site",
            "access_key": "RR1SZ9BPSGXBQQ78ZHLF",
            "secret_key": "HbuDM9yJPrJvpg9mKuARHNpPhadcNLafZ3WqbUo1"
        }
    ],
    "swift_keys": [],
    "caps": [],
    "op_mask": "read, write, delete",
    "system": "true",
    "default_placement": "",
    "default_storage_class": "",
    "placement_tags": [],
    "bucket_quota": {
        "enabled": false,
        "check_on_raw": false,
        "max_size": -1,
        "max_size_kb": 0,
        "max_objects": -1
    },
    "user_quota": {
        "enabled": false,
        "check_on_raw": false,
        "max_size": -1,
        "max_size_kb": 0,
        "max_objects": -1
    },
    "temp_url_keys": [],
    "type": "rgw",
    "mfa_ids": []
}
```
access_key和secret_key在后续创建zone以及拉去realm配置信息时需要。

### 3.5. 更新master zone的access-key和secret-key
`radosgw-admin zone modify --rgw-zone={zone name} --access-key={key} --secret-key={key}`
```bash
radosgw-admin zone modify --rgw-zone=us-east --access-key=RR1SZ9BPSGXBQQ78ZHLF --secret-key=HbuDM9yJPrJvpg9mKuARHNpPhadcNLafZ3WqbUo1
-----------------------------------------------------------------------------------------------------------------------
{
    "id": "b711f710-37c1-4532-984b-5073c052be28",
    "name": "us-east",
    "domain_root": "us-east.rgw.meta:root",
    "control_pool": "us-east.rgw.control",
    "gc_pool": "us-east.rgw.log:gc",
    "lc_pool": "us-east.rgw.log:lc",
    "log_pool": "us-east.rgw.log",
    "intent_log_pool": "us-east.rgw.log:intent",
    "usage_log_pool": "us-east.rgw.log:usage",
    "reshard_pool": "us-east.rgw.log:reshard",
    "user_keys_pool": "us-east.rgw.meta:users.keys",
    "user_email_pool": "us-east.rgw.meta:users.email",
    "user_swift_pool": "us-east.rgw.meta:users.swift",
    "user_uid_pool": "us-east.rgw.meta:users.uid",
    "otp_pool": "us-east.rgw.otp",
    "system_key": {
        "access_key": "RR1SZ9BPSGXBQQ78ZHLF",
        "secret_key": "HbuDM9yJPrJvpg9mKuARHNpPhadcNLafZ3WqbUo1"
    },
    "placement_pools": [
        {
            "key": "default-placement",
            "val": {
                "index_pool": "us-east.rgw.buckets.index",
                "storage_classes": {
                    "STANDARD": {
                        "data_pool": "us-east.rgw.buckets.data"
                    }
                },
                "data_extra_pool": "us-east.rgw.buckets.non-ec",
                "index_type": 0
            }
        }
    ],
    "metadata_heap": "",
    "realm_id": "821d976e-be24-48ef-aeb0-a9882085e7fb"
}
```

### 3.6. 更新并提交period
`radosgw-admin period update --commit`
```bash
radosgw-admin period update --commit
-----------------------------------------------------------------------------------------------------------------------
{
    "id": "539162d3-3c1f-41c9-8513-1947434949a8",
    "epoch": 1,
    "predecessor_uuid": "dec345b1-dfee-4cec-832e-2d3797ad7012",
    "sync_status": [],
    "period_map": {
        "id": "539162d3-3c1f-41c9-8513-1947434949a8",
        "zonegroups": [
            {
                "id": "09143c33-a26f-449a-94c9-11c41ce79ac9",
                "name": "us",
                "api_name": "us",
                "is_master": "true",
                "endpoints": [
                    "http://192.168.3.12:7480"
                ],
                "hostnames": [],
                "hostnames_s3website": [],
                "master_zone": "b711f710-37c1-4532-984b-5073c052be28",
                "zones": [
                    {
                        "id": "b711f710-37c1-4532-984b-5073c052be28",
                        "name": "us-east",
                        "endpoints": [
                            "http://192.168.3.12:7480"
                        ],
                        "log_meta": "false",
                        "log_data": "false",
                        "bucket_index_max_shards": 0,
                        "read_only": "false",
                        "tier_type": "",
                        "sync_from_all": "true",
                        "sync_from": [],
                        "redirect_zone": ""
                    }
                ],
                "placement_targets": [
                    {
                        "name": "default-placement",
                        "tags": [],
                        "storage_classes": [
                            "STANDARD"
                        ]
                    }
                ],
                "default_placement": "default-placement",
                "realm_id": "821d976e-be24-48ef-aeb0-a9882085e7fb"
            }
        ],
        "short_zone_ids": [
            {
                "key": "b711f710-37c1-4532-984b-5073c052be28",
                "val": 2810335027
            }
        ]
    },
    "master_zonegroup": "09143c33-a26f-449a-94c9-11c41ce79ac9",
    "master_zone": "b711f710-37c1-4532-984b-5073c052be28",
    "period_config": {
        "bucket_quota": {
            "enabled": false,
            "check_on_raw": false,
            "max_size": -1,
            "max_size_kb": 0,
            "max_objects": -1
        },
        "user_quota": {
            "enabled": false,
            "check_on_raw": false,
            "max_size": -1,
            "max_size_kb": 0,
            "max_objects": -1
        }
    },
    "realm_id": "821d976e-be24-48ef-aeb0-a9882085e7fb",
    "realm_name": "movies",
    "realm_epoch": 2
}
```
对于zone、zonegroup的任何修改，只有commit period才会生效，commit period过程中会将当前period时期的所有配置修改信息发送给多站点中的其他rgw实例，其他rgw实例收到后会更新本地配置信息。

### 3.7. 更新rgw实例配置并与master zone绑定
```bash
[client.rgw.node1]
host = node1
rgw frontends = "civetweb port=192.168.3.12:7480"
rgw_zone=us-east
```

### 3.8. 重启rgw服务
```bash
systemctl restart ceph-radosgw@rgw.node1.service
```

&nbsp;
&nbsp;
# 4. Second集群配置
### 4.1. 拉取master zonegroup所属的realm配置信息
`radosgw-admin realm pull --url={current master url} --access-key={key} --secret-key={key}`
```bash
radosgw-admin realm pull --url=http://192.168.3.12:7480 --access-key=RR1SZ9BPSGXBQQ78ZHLF --secret-key=HbuDM9yJPrJvpg9mKuARHNpPhadcNLafZ3WqbUo1
-----------------------------------------------------------------------------------------------------------------------
2023-08-06 15:25:05.504 7fd710eb2900  1 error read_lastest_epoch .rgw.root:periods.539162d3-3c1f-41c9-8513-1947434949a8.latest_epoch
2023-08-06 15:25:06.136 7fd710eb2900  1 Set the period's master zonegroup 09143c33-a26f-449a-94c9-11c41ce79ac9 as the default
{
    "id": "821d976e-be24-48ef-aeb0-a9882085e7fb",
    "name": "movies",
    "current_period": "539162d3-3c1f-41c9-8513-1947434949a8",
    "epoch": 2
}
```
执行完上述命令之后，有时会遇到如下问题。
```bash
request failed: (13) Permission denied
If the realm has been changed on the master zone, the master zone's gateway may need to be restarted to recognize this user.
```
通过查看日志后，目前发现有2个原因会导致这种问题：master zone的access-key和secret-key为空值，另外一个是时间不同步。其中最坑人就是key值的缺失。在创建system用户时，一定要等master zone创建完成之后再创建，这个顺序不能乱，如果在还没有创建master zone之前就创建system用户，等执行到提交period，之前创建的system用户竟然被删除了。

### 4.2. 创建second zone并与master zonegroup绑定
`radosgw-admin zone create --rgw-zonegroup={master zonegroup name} --rgw-zone={name} --endpoints={url} --access-key={key} --secret-key={key}`
```bash
radosgw-admin zone create --rgw-zonegroup=us --rgw-zone=us-west --endpoints=http://192.168.3.13:7480 --access-key=RR1SZ9BPSGXBQQ78ZHLF --secret-key=HbuDM9yJPrJvpg9mKuARHNpPhadcNLafZ3WqbUo1
-----------------------------------------------------------------------------------------------------------------------
2023-08-06 15:26:09.574 7f5399906900  0 failed reading obj info from .rgw.root:zone_info.b711f710-37c1-4532-984b-5073c052be28: (2) No such file or directory
2023-08-06 15:26:09.574 7f5399906900  0 WARNING: could not read zone params for zone id=b711f710-37c1-4532-984b-5073c052be28 name=us-east
{
    "id": "84592722-4f81-47ab-a0d4-06f946477a57",
    "name": "us-west",
    "domain_root": "us-west.rgw.meta:root",
    "control_pool": "us-west.rgw.control",
    "gc_pool": "us-west.rgw.log:gc",
    "lc_pool": "us-west.rgw.log:lc",
    "log_pool": "us-west.rgw.log",
    "intent_log_pool": "us-west.rgw.log:intent",
    "usage_log_pool": "us-west.rgw.log:usage",
    "reshard_pool": "us-west.rgw.log:reshard",
    "user_keys_pool": "us-west.rgw.meta:users.keys",
    "user_email_pool": "us-west.rgw.meta:users.email",
    "user_swift_pool": "us-west.rgw.meta:users.swift",
    "user_uid_pool": "us-west.rgw.meta:users.uid",
    "otp_pool": "us-west.rgw.otp",
    "system_key": {
        "access_key": "RR1SZ9BPSGXBQQ78ZHLF",
        "secret_key": "HbuDM9yJPrJvpg9mKuARHNpPhadcNLafZ3WqbUo1"
    },
    "placement_pools": [
        {
            "key": "default-placement",
            "val": {
                "index_pool": "us-west.rgw.buckets.index",
                "storage_classes": {
                    "STANDARD": {
                        "data_pool": "us-west.rgw.buckets.data"
                    }
                },
                "data_extra_pool": "us-west.rgw.buckets.non-ec",
                "index_type": 0
            }
        }
    ],
    "metadata_heap": "",
    "realm_id": "821d976e-be24-48ef-aeb0-a9882085e7fb"
}
```

### 4.3. 更新并提交period
`radosgw-admin period update --commit`
```bash
radosgw-admin period update --commit
-----------------------------------------------------------------------------------------------------------------------
2023-08-06 15:26:51.957 7f7efdb77900  1 Cannot find zone id=84592722-4f81-47ab-a0d4-06f946477a57 (name=us-west), switching to local zonegroup configuration
Sending period to new master zone b711f710-37c1-4532-984b-5073c052be28
{
    "id": "539162d3-3c1f-41c9-8513-1947434949a8",
    "epoch": 2,
    "predecessor_uuid": "dec345b1-dfee-4cec-832e-2d3797ad7012",
    "sync_status": [],
    "period_map": {
        "id": "539162d3-3c1f-41c9-8513-1947434949a8",
        "zonegroups": [
            {
                "id": "09143c33-a26f-449a-94c9-11c41ce79ac9",
                "name": "us",
                "api_name": "us",
                "is_master": "true",
                "endpoints": [
                    "http://192.168.3.12:7480"
                ],
                "hostnames": [],
                "hostnames_s3website": [],
                "master_zone": "b711f710-37c1-4532-984b-5073c052be28",
                "zones": [
                    {
                        "id": "84592722-4f81-47ab-a0d4-06f946477a57",
                        "name": "us-west",
                        "endpoints": [
                            "http://192.168.3.13:7480"
                        ],
                        "log_meta": "false",
                        "log_data": "true",
                        "bucket_index_max_shards": 0,
                        "read_only": "false",
                        "tier_type": "",
                        "sync_from_all": "true",
                        "sync_from": [],
                        "redirect_zone": ""
                    },
                    {
                        "id": "b711f710-37c1-4532-984b-5073c052be28",
                        "name": "us-east",
                        "endpoints": [
                            "http://192.168.3.12:7480"
                        ],
                        "log_meta": "false",
                        "log_data": "true",
                        "bucket_index_max_shards": 0,
                        "read_only": "false",
                        "tier_type": "",
                        "sync_from_all": "true",
                        "sync_from": [],
                        "redirect_zone": ""
                    }
                ],
                "placement_targets": [
                    {
                        "name": "default-placement",
                        "tags": [],
                        "storage_classes": [
                            "STANDARD"
                        ]
                    }
                ],
                "default_placement": "default-placement",
                "realm_id": "821d976e-be24-48ef-aeb0-a9882085e7fb"
            }
        ],
        "short_zone_ids": [
            {
                "key": "84592722-4f81-47ab-a0d4-06f946477a57",
                "val": 3637646402
            },
            {
                "key": "b711f710-37c1-4532-984b-5073c052be28",
                "val": 2810335027
            }
        ]
    },
    "master_zonegroup": "09143c33-a26f-449a-94c9-11c41ce79ac9",
    "master_zone": "b711f710-37c1-4532-984b-5073c052be28",
    "period_config": {
        "bucket_quota": {
            "enabled": false,
            "check_on_raw": false,
            "max_size": -1,
            "max_size_kb": 0,
            "max_objects": -1
        },
        "user_quota": {
            "enabled": false,
            "check_on_raw": false,
            "max_size": -1,
            "max_size_kb": 0,
            "max_objects": -1
        }
    },
    "realm_id": "821d976e-be24-48ef-aeb0-a9882085e7fb",
    "realm_name": "movies",
    "realm_epoch": 2
}
```
从上面输出信息可以看到us-west和us-east都是归属于us，并且us-east是master zone。

### 4.4. 更新rgw实例配置并与second zone绑定
```bash
[client.rgw.node2]
host = node2
rgw frontends = "civetweb port=192.168.3.13:7480"
rgw_zone=us-west
```

### 4.5. 重启rgw服务
```bash
systemctl restart ceph-radosgw@rgw.node2.service
```

### 4.6. 查看同步状态
`radosgw-admin sync status`
```bash
radosgw-admin sync status
-----------------------------------------------------------------------------------------------------------------------
          realm 821d976e-be24-48ef-aeb0-a9882085e7fb (movies)
      zonegroup 09143c33-a26f-449a-94c9-11c41ce79ac9 (us)
           zone 84592722-4f81-47ab-a0d4-06f946477a57 (us-west)
  metadata sync syncing
                full sync: 0/64 shards
                incremental sync: 64/64 shards
                metadata is caught up with master
      data sync source: b711f710-37c1-4532-984b-5073c052be28 (us-east)
                        syncing
                        full sync: 0/128 shards
                        incremental sync: 128/128 shards
                        data is caught up with source
```

&nbsp;
&nbsp;
# 5. 灾难恢复
当由于某些原因导致master出现故障，导致无法写入数据，此时可以将second zone升级为master zone。当多站点中存在新的master zone后，如果出现故障的master恢复了，此时恢复后的master已经不再担任master角色，而是second角色，同时数据同步功能恢复正常。

### 5.1. 将second zone提升为master zone
`radosgw-admin zone modify --rgw-zone={zone name} --master --default`
```bash
radosgw-admin zone modify --rgw-zone=us-west --master --default
-----------------------------------------------------------------------------------------------------------------------
2023-08-06 15:33:02.052 7faad265a900  0 NOTICE: overriding master zone: b711f710-37c1-4532-984b-5073c052be28
2023-08-06 15:33:02.056 7faad265a900  0 failed reading obj info from .rgw.root:zone_info.b711f710-37c1-4532-984b-5073c052be28: (2) No such file or directory
2023-08-06 15:33:02.056 7faad265a900  0 WARNING: could not read zone params for zone id=b711f710-37c1-4532-984b-5073c052be28 name=us-east
{
    "id": "84592722-4f81-47ab-a0d4-06f946477a57",
    "name": "us-west",
    "domain_root": "us-west.rgw.meta:root",
    "control_pool": "us-west.rgw.control",
    "gc_pool": "us-west.rgw.log:gc",
    "lc_pool": "us-west.rgw.log:lc",
    "log_pool": "us-west.rgw.log",
    "intent_log_pool": "us-west.rgw.log:intent",
    "usage_log_pool": "us-west.rgw.log:usage",
    "reshard_pool": "us-west.rgw.log:reshard",
    "user_keys_pool": "us-west.rgw.meta:users.keys",
    "user_email_pool": "us-west.rgw.meta:users.email",
    "user_swift_pool": "us-west.rgw.meta:users.swift",
    "user_uid_pool": "us-west.rgw.meta:users.uid",
    "otp_pool": "us-west.rgw.otp",
    "system_key": {
        "access_key": "RR1SZ9BPSGXBQQ78ZHLF",
        "secret_key": "HbuDM9yJPrJvpg9mKuARHNpPhadcNLafZ3WqbUo1"
    },
    "placement_pools": [
        {
            "key": "default-placement",
            "val": {
                "index_pool": "us-west.rgw.buckets.index",
                "storage_classes": {
                    "STANDARD": {
                        "data_pool": "us-west.rgw.buckets.data"
                    }
                },
                "data_extra_pool": "us-west.rgw.buckets.non-ec",
                "index_type": 0
            }
        }
    ],
    "metadata_heap": "",
    "realm_id": "821d976e-be24-48ef-aeb0-a9882085e7fb"
}
```

### 5.2. 更新并提交period
`radosgw-admin period update --commit`
```bash
radosgw-admin period update --commit
-----------------------------------------------------------------------------------------------------------------------
{
    "id": "baf807ae-b904-4721-982d-eea5a751ff27",
    "epoch": 1,
    "predecessor_uuid": "539162d3-3c1f-41c9-8513-1947434949a8",
    "sync_status": [],
    "period_map": {
        "id": "baf807ae-b904-4721-982d-eea5a751ff27",
        "zonegroups": [
            {
                "id": "09143c33-a26f-449a-94c9-11c41ce79ac9",
                "name": "us",
                "api_name": "us",
                "is_master": "true",
                "endpoints": [
                    "http://192.168.3.12:7480"
                ],
                "hostnames": [],
                "hostnames_s3website": [],
                "master_zone": "84592722-4f81-47ab-a0d4-06f946477a57",
                "zones": [
                    {
                        "id": "84592722-4f81-47ab-a0d4-06f946477a57",
                        "name": "us-west",
                        "endpoints": [
                            "http://192.168.3.13:7480"
                        ],
                        "log_meta": "false",
                        "log_data": "true",
                        "bucket_index_max_shards": 0,
                        "read_only": "false",
                        "tier_type": "",
                        "sync_from_all": "true",
                        "sync_from": [],
                        "redirect_zone": ""
                    },
                    {
                        "id": "b711f710-37c1-4532-984b-5073c052be28",
                        "name": "us-east",
                        "endpoints": [
                            "http://192.168.3.12:7480"
                        ],
                        "log_meta": "false",
                        "log_data": "true",
                        "bucket_index_max_shards": 0,
                        "read_only": "false",
                        "tier_type": "",
                        "sync_from_all": "true",
                        "sync_from": [],
                        "redirect_zone": ""
                    }
                ],
                "placement_targets": [
                    {
                        "name": "default-placement",
                        "tags": [],
                        "storage_classes": [
                            "STANDARD"
                        ]
                    }
                ],
                "default_placement": "default-placement",
                "realm_id": "821d976e-be24-48ef-aeb0-a9882085e7fb"
            }
        ],
        "short_zone_ids": [
            {
                "key": "84592722-4f81-47ab-a0d4-06f946477a57",
                "val": 3637646402
            },
            {
                "key": "b711f710-37c1-4532-984b-5073c052be28",
                "val": 2810335027
            }
        ]
    },
    "master_zonegroup": "09143c33-a26f-449a-94c9-11c41ce79ac9",
    "master_zone": "84592722-4f81-47ab-a0d4-06f946477a57",
    "period_config": {
        "bucket_quota": {
            "enabled": false,
            "check_on_raw": false,
            "max_size": -1,
            "max_size_kb": 0,
            "max_objects": -1
        },
        "user_quota": {
            "enabled": false,
            "check_on_raw": false,
            "max_size": -1,
            "max_size_kb": 0,
            "max_objects": -1
        }
    },
    "realm_id": "821d976e-be24-48ef-aeb0-a9882085e7fb",
    "realm_name": "movies",
    "realm_epoch": 3
}
```

### 5.3. 重启rgw服务
```bash
systemctl restart ceph-radosgw@rgw.node2.service
```
如果想让出现故障的master zone在恢复正常后依然执行master角色，如果多站点中已经存在master，此时只能通过手动修改zone的配置。如果多站点中不存在master，此时恢复正常的master zone自动成为master角色，以下是假设多站点中已经存在master的相关处理。

### 5.4. 拉取master zonegroup所属的realm配置信息
`radosgw-admin realm pull --url={current master url} --access-key={key} --secret-key={key}`
```bash
radosgw-admin realm pull --url=http://192.168.3.13:7480 --access-key=RR1SZ9BPSGXBQQ78ZHLF --secret-key=HbuDM9yJPrJvpg9mKuARHNpPhadcNLafZ3WqbUo1
-----------------------------------------------------------------------------------------------------------------------
{
    "id": "821d976e-be24-48ef-aeb0-a9882085e7fb",
    "name": "movies",
    "current_period": "baf807ae-b904-4721-982d-eea5a751ff27",
    "epoch": 3
}
```

### 5.5. 恢复旧的master zone
`radosgw-admin zone modify --rgw-zone={zone name} --master --default`
```bash
radosgw-admin zone modify --rgw-zone=us-east --master --default
-----------------------------------------------------------------------------------------------------------------------
2023-08-06 15:44:05.186 7fb6ecea7900  0 NOTICE: overriding master zone: 84592722-4f81-47ab-a0d4-06f946477a57
2023-08-06 15:44:05.186 7fb6ecea7900  0 failed reading obj info from .rgw.root:zone_info.84592722-4f81-47ab-a0d4-06f946477a57: (2) No such file or directory
2023-08-06 15:44:05.186 7fb6ecea7900  0 WARNING: could not read zone params for zone id=84592722-4f81-47ab-a0d4-06f946477a57 name=us-west
{
    "id": "b711f710-37c1-4532-984b-5073c052be28",
    "name": "us-east",
    "domain_root": "us-east.rgw.meta:root",
    "control_pool": "us-east.rgw.control",
    "gc_pool": "us-east.rgw.log:gc",
    "lc_pool": "us-east.rgw.log:lc",
    "log_pool": "us-east.rgw.log",
    "intent_log_pool": "us-east.rgw.log:intent",
    "usage_log_pool": "us-east.rgw.log:usage",
    "reshard_pool": "us-east.rgw.log:reshard",
    "user_keys_pool": "us-east.rgw.meta:users.keys",
    "user_email_pool": "us-east.rgw.meta:users.email",
    "user_swift_pool": "us-east.rgw.meta:users.swift",
    "user_uid_pool": "us-east.rgw.meta:users.uid",
    "otp_pool": "us-east.rgw.otp",
    "system_key": {
        "access_key": "RR1SZ9BPSGXBQQ78ZHLF",
        "secret_key": "HbuDM9yJPrJvpg9mKuARHNpPhadcNLafZ3WqbUo1"
    },
    "placement_pools": [
        {
            "key": "default-placement",
            "val": {
                "index_pool": "us-east.rgw.buckets.index",
                "storage_classes": {
                    "STANDARD": {
                        "data_pool": "us-east.rgw.buckets.data"
                    }
                },
                "data_extra_pool": "us-east.rgw.buckets.non-ec",
                "index_type": 0
            }
        }
    ],
    "metadata_heap": "",
    "realm_id": "821d976e-be24-48ef-aeb0-a9882085e7fb"
}
```

### 5.6. 更新并提交period
`radosgw-admin period update --commit`
```bash
radosgw-admin period update --commit
-----------------------------------------------------------------------------------------------------------------------
{
    "id": "6157442a-fe91-44a7-9404-44ba291ba105",
    "epoch": 1,
    "predecessor_uuid": "baf807ae-b904-4721-982d-eea5a751ff27",
    "sync_status": [],
    "period_map": {
        "id": "6157442a-fe91-44a7-9404-44ba291ba105",
        "zonegroups": [
            {
                "id": "09143c33-a26f-449a-94c9-11c41ce79ac9",
                "name": "us",
                "api_name": "us",
                "is_master": "true",
                "endpoints": [
                    "http://192.168.3.12:7480"
                ],
                "hostnames": [],
                "hostnames_s3website": [],
                "master_zone": "b711f710-37c1-4532-984b-5073c052be28",
                "zones": [
                    {
                        "id": "84592722-4f81-47ab-a0d4-06f946477a57",
                        "name": "us-west",
                        "endpoints": [
                            "http://192.168.3.13:7480"
                        ],
                        "log_meta": "false",
                        "log_data": "true",
                        "bucket_index_max_shards": 0,
                        "read_only": "false",
                        "tier_type": "",
                        "sync_from_all": "true",
                        "sync_from": [],
                        "redirect_zone": ""
                    },
                    {
                        "id": "b711f710-37c1-4532-984b-5073c052be28",
                        "name": "us-east",
                        "endpoints": [
                            "http://192.168.3.12:7480"
                        ],
                        "log_meta": "false",
                        "log_data": "true",
                        "bucket_index_max_shards": 0,
                        "read_only": "false",
                        "tier_type": "",
                        "sync_from_all": "true",
                        "sync_from": [],
                        "redirect_zone": ""
                    }
                ],
                "placement_targets": [
                    {
                        "name": "default-placement",
                        "tags": [],
                        "storage_classes": [
                            "STANDARD"
                        ]
                    }
                ],
                "default_placement": "default-placement",
                "realm_id": "821d976e-be24-48ef-aeb0-a9882085e7fb"
            }
        ],
        "short_zone_ids": [
            {
                "key": "84592722-4f81-47ab-a0d4-06f946477a57",
                "val": 3637646402
            },
            {
                "key": "b711f710-37c1-4532-984b-5073c052be28",
                "val": 2810335027
            }
        ]
    },
    "master_zonegroup": "09143c33-a26f-449a-94c9-11c41ce79ac9",
    "master_zone": "b711f710-37c1-4532-984b-5073c052be28",
    "period_config": {
        "bucket_quota": {
            "enabled": false,
            "check_on_raw": false,
            "max_size": -1,
            "max_size_kb": 0,
            "max_objects": -1
        },
        "user_quota": {
            "enabled": false,
            "check_on_raw": false,
            "max_size": -1,
            "max_size_kb": 0,
            "max_objects": -1
        }
    },
    "realm_id": "821d976e-be24-48ef-aeb0-a9882085e7fb",
    "realm_name": "movies",
    "realm_epoch": 4
}
```

### 5.7. 重启rgw服务
```bash
systemctl restart ceph-radosgw@rgw.node1.service
```
---
title: Lustre系统工具-lfs migrate
date: 2021-07-07T16:27:14+0800
description: "本文分析Lustre 2.15.4的lfs migrate代码逻辑"
tags: [lustre]
---

> lustre版本：2.15.4

以下所有的代码流程参考命令`lfs migrate -c 2 ./abc/test.txt`。

# 1. main
`文件路径：lustre/utils/lfs.c`  
mian函数中调用Parser_execarg函数对用户输入的lfs命令进行解析。

```C
int main(int argc, char **argv)
{
  int rc;
  // ......

  if (argc > 1) {
    llapi_set_command_name(argv[1]);
    // 解析lfs命令和参数
    rc = Parser_execarg(argc - 1, argv + 1, cmdlist);
    llapi_clear_command_name();
  } else {
    rc = Parser_commands();
  }

  // ......
}
```

# 2. Parser_execarg
`文件路径：libcfs/libcfs/util/parser.c`  
Parser_execarg函数会从cmdlist中查找并匹配migrate命令，如果匹配成功，则执行lfs_setstripe_migrate函数。

```C
int Parser_execarg(int argc, char **argv, command_t cmds[])
{
  command_t *cmd;
  // 从cmdlist中查找并匹配migrate命令
  cmd = Parser_findargcmd(argv[0], cmds);

  if (cmd && cmd->pc_func) {
    // 执行migrate命令对应的函数
    // migrate命令对应的pc_func可以从cmdlist中查看到为lfs_setstripe_migrate
    int rc = cmd->pc_func(argc, argv);

    if (rc == CMD_HELP)
      fprintf(stderr, "%s\n", cmd->pc_help);
    return rc;
  }

  // ......
  return -1;
}
```

# 3. lfs_setstripe_migrate
`文件路径：lustre/utils/lfs.c`  

```C
static inline int lfs_setstripe_migrate(int argc, char **argv)
{
	return lfs_setstripe_internal(argc, argv, SO_MIGRATE);
}
```

# 4. lfs_setstripe_internal
`文件路径：lustre/utils/lfs.c`  

```C
static int lfs_setstripe_internal(int argc, char **argv,
          enum setstripe_origin opc)
{
  // ......
  // 以上省略的代码主要是初始化lsa
  // 以上省略的代码可以得到几个关键变量
  // mirror_mode=true layout=NULL from_copy=false migration_flags=0

  if (migrate_mdt_mode) {
    // ......
  } else if (!layout) {
    // ......
    // 初始化param
    param = calloc(1, offsetof(typeof(*param),
          lsp_osts[lsa.lsa_nr_tgts]));
    // 填充param参数
    if (lsa.lsa_stripe_size != LLAPI_LAYOUT_DEFAULT)
      param->lsp_stripe_size = lsa.lsa_stripe_size;
    if (lsa.lsa_stripe_count != LLAPI_LAYOUT_DEFAULT) {
      if (lsa.lsa_stripe_count == LLAPI_LAYOUT_WIDE)
        param->lsp_stripe_count = -1;
      else
        param->lsp_stripe_count = lsa.lsa_stripe_count;
    }
    if (lsa.lsa_stripe_off == LLAPI_LAYOUT_DEFAULT)
      param->lsp_stripe_offset = -1;
    else
      param->lsp_stripe_offset = lsa.lsa_stripe_off;
    param->lsp_stripe_pattern =
        llapi_pattern_to_lov(lsa.lsa_pattern);
    if (param->lsp_stripe_pattern == EINVAL) {
      fprintf(stderr, "error: %s: invalid stripe pattern\n",
        argv[0]);
      free(param);
      goto usage_error;
    }
    param->lsp_pool = lsa.lsa_pool_name;
    param->lsp_is_specific = false;
  }

  // ......
  // 调用lfs_migrate函数
  if (migrate_mdt_mode) {
    result = llapi_migrate_mdt(fname, &migrate_mdt_param);
  } else if (migrate_mode) {
    result = lfs_migrate(fname, migration_flags, param,
              layout);
  }

  // ......
}
```

# 5. lfs_migrate
`文件路径：lustre/utils/lfs.c`  

```C
static int lfs_migrate(char *name, __u64 migration_flags,
          struct llapi_stripe_param *param,
          struct llapi_layout *layout)
{
  // ......
  // 打开一个临时的字符设备,如果该字符设备不存在,则创建
  rc = migrate_open_files(name, migration_flags, param, layout,
      &fd, &fdv);

  // ......
  existing = llapi_layout_get_by_fd(fd, 0);

  // ......
  if (!(migration_flags & LLAPI_MIGRATION_NONBLOCK)) {
    /*
      * Blocking mode (forced if servers do not support file lease).
      * It is also the default mode, since we cannot distinguish
      * between a broken lease and a server that does not support
      * atomic swap/close (LU-6785)
      */
    rc = migrate_block(fd, fdv);
    goto out;
  }

  // ......
}
```

# 6. migrate_open_files
`文件路径：lustre/utils/lfs.c`  

```C
static int migrate_open_files(const char *name, __u64 migration_flags,
        const struct llapi_stripe_param *param,
        struct llapi_layout *layout, int *fd_src, int *fd_tgt)
{
  // 初始化父目录路径
  strncpy(parent, name, sizeof(parent));
  ptr = strrchr(parent, '/');

  // 如果name中没有指定路径,则获取当前文件的绝对路径
  if (!ptr) {
    if (!getcwd(parent, sizeof(parent))) {
      error_loc = "getcwd";
      return -errno;
    }
  } else {
    if (ptr == parent) /* leading '/' */
      ptr = parent + 1;
    *ptr = '\0';
  }

  // ......
  // 创建一个临时字文件
  do {
    // 设置临时文件打开方式
    int open_flags = O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW |
      /* Allow migrating without the key on encrypted files */
      O_FILE_ENC;
    // 设置临时文件权限
    mode_t open_mode = S_IRUSR | S_IWUSR;

    if (rflags & O_DIRECT)
      open_flags |= O_DIRECT;
    // 产生随机数
    random_value = random();
    // 拼接临时文件的名字,名字类似:/mnt/lustre/.0c131412:VOLATILE:0:1:fd=1
    rc = snprintf(volatile_file, sizeof(volatile_file),
            "%s/%s:%.4X:%.4X:fd=%.2d", parent,
            LUSTRE_VOLATILE_HDR, mdt_index,
            random_value, fd);

    // ......

    /* create, open a volatile file, use caching (ie no directio) */
    if (layout) {
      /* Returns -1 and sets errno on error: */
      fdv = llapi_layout_file_open(volatile_file, open_flags,
                  open_mode, layout);
      if (fdv < 0)
        fdv = -errno;
    } else {
      /* Does the right thing on error: */
      fdv = llapi_file_open_param(volatile_file, open_flags,
                open_mode, param);
    }
  } while (fdv < 0 && (rc = fdv) == -EEXIST);

  // ......
}
```

# 7. llapi_file_open_param
`文件路径:lustre/utils/liblustreapi.c`  

```C
int llapi_file_open_param(const char *name, int flags, mode_t mode,
        const struct llapi_stripe_param *param)
{
  // ......
  // 打开临时文件,如果不存在,则创建
  fd = open(name, flags | O_LOV_DELAY_CREATE, mode);
  
  // ......
  // 初始化lum
  lum->lmm_magic = LOV_USER_MAGIC_V1;
  lum->lmm_pattern = param->lsp_stripe_pattern;
  lum->lmm_stripe_size = param->lsp_stripe_size;
  lum->lmm_stripe_count = param->lsp_stripe_count;
  lum->lmm_stripe_offset = param->lsp_stripe_offset;

  // ......
  // 设置临时文件的layout
  if (ioctl(fd, LL_IOC_LOV_SETSTRIPE, lum) != 0) {
    // ......
  }
}
```
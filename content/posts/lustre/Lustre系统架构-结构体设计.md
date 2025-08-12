---
title: Lustre系统架构-结构体设计
date: 2021-07-07T16:27:14+0800
description: "本文分析Lustre 2.15.4源码中相关结构体的设计思想"
tags: [lustre]
---

> lustre版本：2.15.4

# 1. lfs_setstripe_args

```C
struct lfs_setstripe_args {
	unsigned long long	 lsa_comp_end;
	unsigned long long	 lsa_stripe_size;
	unsigned long long	 lsa_extension_size;
	long long		 lsa_stripe_count;
	long long		 lsa_stripe_off;
	__u32			 lsa_comp_flags;
	__u32			 lsa_comp_neg_flags;
	unsigned long long	 lsa_pattern;
	unsigned int		 lsa_mirror_count;
	int			 lsa_nr_tgts;
	bool			 lsa_first_comp;
	bool			 lsa_extension_comp;
	__u32			*lsa_tgts;
	char			*lsa_pool_name;
};
```

# 2. llapi_stripe_param

llapi全称lib lustre api

```C
struct llapi_stripe_param {
	unsigned long long	lsp_stripe_size;
	char			*lsp_pool;
	int			lsp_stripe_offset;
	int			lsp_stripe_pattern;
	/* Number of stripes. Size of lsp_osts[] if lsp_specific is true.*/
	int			lsp_stripe_count;
	bool			lsp_is_specific;
	bool			lsp_is_create;
	__u8			lsp_max_inherit;
	__u8			lsp_max_inherit_rr;
	__u32			lsp_osts[0];
};
```

# 3. llapi_layout

```C
struct llapi_layout {
	uint32_t	llot_magic; /* LLAPI_LAYOUT_MAGIC */
	uint32_t	llot_gen;
	uint32_t	llot_flags;
	bool		llot_is_composite;
	uint16_t	llot_mirror_count;
	/* Cursor pointing to one of the components in llot_comp_list */
	struct llapi_layout_comp *llot_cur_comp;
	struct list_head	  llot_comp_list;
};
```
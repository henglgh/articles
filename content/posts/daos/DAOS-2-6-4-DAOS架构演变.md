---
title: "DAOS架构演变：从持久内存到无持久内存的灵活适配"
date: 2026-2-27T09:00:00+0800
description: "本文详细介绍DAOS.2.6.0中针对object的操作如何转化成针对target的操作。"
tags: [daos]
---

# 架构演变

作为面向超算和 AI 场景的下一代分布式存储系统，DAOS 凭借其独特的架构设计，近年来备受关注。DAOS 从 2.6.x 版本开始进行了一次关键性的演进：支持在无持久内存（Persistent Memory, PMEM）环境下的稳定运行。这一变化不仅拓展了 DAOS 的应用边界，也体现了其对多样化硬件生态的深度适配能力。我们先来看一张对比图：

![architecture_evolution](https://raw.githubusercontent.com/henglgh/articles/main/static/images/daos/architecture_evolution.png)

左侧是传统的 DAOS 架构，依赖于持久内存（PMEM）作为核心组件；右侧则是最新优化后的架构，在不使用 PMEM 的情况下依然能高效运作。

# 从“必须”到“可选”：PMEM 的角色转变

早期的 DAOS 架构中，持久内存（如 Intel Optane DC Persistent Memory）扮演着至关重要的角色。PMEM 通过内存接口直接与 DAOS 存储引擎通信，提供接近 DRAM 的访问速度，同时具备断电数据持久化的特性。这种“内存级”的读写能力，使得 DAOS 能够在元数据管理、日志记录等关键路径上实现极致性能。

然而，尽管 PMEM 带来了性能上的突破，其成本较高、部署复杂、兼容性要求严格等问题也逐渐显现。尤其是在大规模集群环境中，统一管理不同类型的内存设备对系统运维提出了更高挑战。因此，DAOS 团队开始探索一种更加灵活、普适性强的架构路径——即不再强制依赖 PMEM，而是将传统 DRAM 与 SSD 组合起来实现类似的性能表现。

最新的 DAOS 架构实现了对 PMEM 的“去耦合”。当系统中不存在 PMEM 时，DAOS 会自动切换至另一种路径：利用 DRAM + WAL（Write-Ahead Log）机制来替代原本由 PMEM 承担的功能。这意味着，即使没有 PMEM，DAOS 仍然可以构建出高可靠、低延迟的存储服务。

# 技术细节：如何实现平滑过渡？

![metadata_on_ssd](https://raw.githubusercontent.com/henglgh/articles/main/static/images/daos/metadata_on_ssd.png)

在“无 PMEM”模式下，DAOS 的核心策略是将 WAL 逻辑迁移到 DRAM 中，并通过 NVMe SSD 完成数据落盘。具体来说：

- 原本由 PMEM 承载的元数据操作和日志写入任务，现在由 DRAM 中的缓冲区暂存；
- 所有写操作仍遵循 WAL 原则，确保数据一致性；
- 写入的日志会被异步刷入 SSD，而读取路径则尽可能绕过慢速存储层，保持响应速度。

虽然 DRAM 不具备断电持久性，但通过精心设计的事务处理流程和检查点机制，DAOS 能够保证在崩溃后快速恢复状态，从而在可用性和性能之间取得平衡。

此外，DAOS 存储引擎本身并未因硬件差异而改变其核心逻辑。无论是 PMEM 还是 DRAM+SSD 组合，上层的 DAOS 库（DAOS Library）和计算节点之间的交互方式保持一致。这种抽象层的稳定性，让应用无需感知底层硬件的变化，真正实现了“透明化”的存储体验。

# 小结

DAOS 的架构演变不仅是一次技术迭代，更是对存储系统本质的一次深刻思考：如何在性能、成本与可用性之间取得最佳平衡？答案或许就藏在这些看似细微却至关重要的架构调整之中。对于每一位关注高性能存储的技术人而言，这都值得我们持续关注与学习。未来，我们或许会看到 DAOS 进一步融合 AI 调度、智能分层、异构计算等技术，继续推动存储系统向智能化、弹性化方向发展。

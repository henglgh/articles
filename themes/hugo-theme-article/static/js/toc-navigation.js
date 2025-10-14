document.addEventListener('DOMContentLoaded', function() {
  // 目录平滑滚动功能
  // 获取singleRightSide元素中的所有链接
  const singleRightSide = document.querySelector('.singleRightSide');
  if (!singleRightSide) return;

  // 获取目录链接
  const tocLinks = singleRightSide.querySelectorAll('#TableOfContents a');

  // 添加一个标志来跟踪是否正在进行手动滚动
  let isScrolling = false;
  let scrollTimeout;

  // 禁用目录链接的默认跳转行为
  tocLinks.forEach(activeLink => {
    activeLink.addEventListener('click', function(e) {
      // 阻止默认跳转行为
      e.preventDefault();

      // 设置滚动标志
      isScrolling = true;
      clearTimeout(scrollTimeout);

      // 获取目标元素的ID
      const targetId = this.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        // 获取headerMain的高度（包含外边距）
        const header = document.querySelector('.headerMain');
        let headerHeight = 0;
        if (header) {
          const rect = header.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(header);
          const marginTop = parseFloat(computedStyle.marginTop);
          const marginBottom = parseFloat(computedStyle.marginBottom);
          headerHeight = rect.height + marginTop + marginBottom;
        }

        // 获取滚动容器
        const scrollContainer = document.querySelector('.singleMain');

        // 计算目标位置（考虑header高度）
        const targetPosition = targetElement.offsetTop - headerHeight;

        // 平滑滚动到目标元素（考虑header偏移）
        scrollContainer.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
        // 手动触发一次目录高亮
        // 移除所有高亮
        tocLinks.forEach(link => {
          link.classList.remove('active');
        });
        activeLink.classList.add('active');

        // 在滚动完成后更新URL和清除滚动标志
        setTimeout(() => {
          // 更新URL但不触发跳转
          history.pushState(null, null, this.getAttribute('href'));
          isScrolling = false;
        }, 1000);
      }
    });
  });

  // 目录高亮功能
  // 获取所有标题元素
  const headers = document.querySelectorAll('.singleArticle .content h1, .singleArticle .content h2, .singleArticle .content h3, .singleArticle .content h4, .singleArticle .content h5');

  // 为每个标题添加ID（如果还没有的话）
  headers.forEach((header, index) => {
    if (!header.id) {
      header.id = 'header-' + index;
    }
  });

  // 创建交叉观察器实现目录高亮
  const observer = new IntersectionObserver((entries) => {
    // 如果正在手动滚动，跳过高亮逻辑
    if (isScrolling) return;

    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // 移除所有高亮
        tocLinks.forEach(link => {
          link.classList.remove('active');
        });

        // 为当前可见的标题对应的链接添加高亮
        const activeLink = document.querySelector(`#TableOfContents a[href="#${entry.target.id}"]`);
        if (activeLink) {
          activeLink.classList.add('active');
          // 自动滚动目录，使高亮项可见
          const tocContainer = document.getElementById('TableOfContents');
          if (tocContainer) {
            activeLink.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          }
        }
      }
    });
  }, {
    rootMargin: '-15% 0% -85% 0%' // 当标题进入中间区域时触发
  });

  // 观察所有标题
  headers.forEach(header => {
    observer.observe(header);
  });
});
document.addEventListener('DOMContentLoaded', function() {
  // 获取singleRightSide元素中的所有链接
  const singleRightSide = document.querySelector('.singleRightSide');
  if (!singleRightSide) return;

  // 获取目录链接
  const tocLinks = singleRightSide.querySelectorAll('#TableOfContents a');

  // 禁用目录链接的默认跳转行为
  tocLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      // 阻止默认跳转行为
      e.preventDefault();

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

        // 更新URL但不触发跳转
        history.pushState(null, null, this.getAttribute('href'));
      }
    });
  });
});
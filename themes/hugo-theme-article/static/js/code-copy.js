document.addEventListener('DOMContentLoaded', () => {
// 1. 查找所有<pre>标签
const preBlocks = document.querySelectorAll('pre');

preBlocks.forEach(function(preBlock) {
  // 2. 为每个<pre>创建复制按钮
  const button = document.createElement('button');
  button.textContent = 'Copy';
  button.className = 'copy-code-btn';
  
  // 3. 将按钮添加到<pre>元素附近
  preBlock.parentNode.insertBefore(button, preBlock);
  
  // 4. 绑定点击事件
  button.addEventListener('click', function() {
    // 5. 获取<pre>内<code>的文本内容
    const codeElement = preBlock.querySelector('code');
    const codeText = codeElement ? codeElement.textContent : preBlock.textContent;

    // 6. 执行复制操作
    navigator.clipboard.writeText(codeText)
    .then(() => {
        // 成功处理
        button.textContent = 'success';
        button.classList.add('success');
        setTimeout(() => {
            button.textContent = 'Copy';
            button.classList.remove('success');
        }, 2000);
    })
    .catch(() => {
        // 失败处理
        button.textContent = 'failed';
        setTimeout(() => {
            button.textContent = 'Copy';
        }, 2000);
    });
  });
});
});
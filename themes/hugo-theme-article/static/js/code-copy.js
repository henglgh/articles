document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('pre > code').forEach(codeBlock => {
    const pre = codeBlock.parentElement;
    const button = document.createElement('button');
    button.className = 'copy-code-btn';
    button.textContent = 'copy';
    
    button.addEventListener('click', async () => {
      const code = codeBlock.textContent;
      try {
        await navigator.clipboard.writeText(code);
        button.textContent = 'sucess';
        button.classList.add('success');
        
        setTimeout(() => {
          button.textContent = 'copy';
          button.classList.remove('success');
        }, 2000);
      } catch (err) {
        button.textContent = 'failed';
      }
    });
    
    pre.appendChild(button);
  });
});
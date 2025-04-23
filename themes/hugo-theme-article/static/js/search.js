const searchInput = document.getElementById('search');
const searchOutput = document.getElementById('searchResults');

const headerMenu = document.querySelector('.headerMenu');
const headerMenuSearch = document.querySelector('.headerMenuSearch');

searchInput.addEventListener('click', function(e) {
  e.stopPropagation();
  headerMenu.classList.add('searchActive');
  headerMenuSearch.classList.add('expanded');
});

document.addEventListener('click', function(e) {
  if (!headerMenuSearch.contains(e.target) && searchInput.value === '') {
    headerMenu.classList.remove('searchActive');
    headerMenuSearch.classList.remove('expanded');
  }
});

const indexUrl = window.SEARCH_INDEX_URL;
// 加载索引文件并初始化 Lunr.js
fetch(indexUrl)
  .then(response => response.json())
  .then(data => {
    const idx = lunr(function () {
      this.ref('url');
      this.field('title');
      // this.field('content');
      data.forEach(doc => this.add(doc));
    });

    // 搜索框逻辑
    searchInput.addEventListener('input', function () {
      const query = searchInput.value;
      if (query.length < 2) {
        searchOutput.innerHTML = '';
        return;
      }

      const results = idx.search(`*${query}*`);
      searchOutput.innerHTML = '';
      if (results.length > 0) {
        results.forEach(result => {
          const item = data.find(doc => doc.url === result.ref);
          searchOutput.innerHTML += `<a href="${item.url}">${item.title}</a><br>`;
        });
      } else {
        searchOutput.innerHTML = 'No results found';
      }
    });
  });
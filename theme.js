// theme.js
(function() {
    const savedTheme = localStorage.getItem('aquaTheme');
    if (savedTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
})();

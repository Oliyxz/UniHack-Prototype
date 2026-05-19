// settings.js
const themeToggle = document.getElementById('theme-toggle');

// Initialize toggle state based on localStorage
const currentTheme = localStorage.getItem('aquaTheme');
if (currentTheme === 'light') {
    themeToggle.checked = true;
}

// Handle toggle click
themeToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('aquaTheme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('aquaTheme', 'dark');
    }
});

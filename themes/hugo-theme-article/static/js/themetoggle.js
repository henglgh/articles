function setTheme(mode) {
    localStorage.setItem("theme-storage", mode);
    const iconElement = document.getElementById("theme-icon");

    if (mode === "dark") {
        document.getElementById("darkModeStyle").disabled = false;
        document.getElementById("codeDarkStyle").disabled = false;
        iconElement.setAttribute("data-feather", "moon");
    } else if (mode === "light") {
        document.getElementById("darkModeStyle").disabled = true;
        document.getElementById("codeDarkStyle").disabled = true;
        iconElement.setAttribute("data-feather", "sun");
    }

    iconElement.setAttribute('stroke-width', '3');
    feather.replace();
}

function toggleTheme() {
    if (localStorage.getItem("theme-storage") === "light") {
        setTheme("dark");
    } else if (localStorage.getItem("theme-storage") === "dark") {
        setTheme("light");
    }
}

var savedTheme = localStorage.getItem("theme-storage") || "light";
setTheme(savedTheme);

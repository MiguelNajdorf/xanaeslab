import { currentUser, logout } from '../apiClient.js';

const NAV_ITEMS = [
    { label: 'Dashboard', href: './admin-dashboard.html' },
    { label: 'Supermercados', href: './supermercados.html' },
    { label: 'Marcas', href: './marcas.html' },
    { label: 'Barrios', href: './barrios.html' },
    { label: 'Recolección', href: './recoleccion.html' },
    { label: 'Farmacias', href: './farmacias.html' },
    { label: 'Categorías', href: './categorias.html' },
    { label: 'Productos', href: './productos.html' },
    { label: 'Precios', href: './precios.html' },
    { label: 'Ofertas', href: './ofertas.html' },
];

export async function initAdminNav() {
    // Verify user is admin
    try {
        const user = await currentUser();
        if (user?.role !== 'admin') {
            window.location.href = './admin-login.html';
            return;
        }
    } catch (error) {
        window.location.href = './admin-login.html';
        return;
    }

    // Create nav element
    const nav = document.createElement('nav');
    nav.className = 'admin-nav';
    nav.id = 'admin-nav';

    // Get current page
    const currentPath = window.location.pathname.split('/').pop();

    // Create nav items
    const navList = document.createElement('ul');
    NAV_ITEMS.forEach(item => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = item.href;
        a.textContent = item.label;

        // Mark active
        if (item.href.includes(currentPath)) {
            a.classList.add('active');
        }

        li.appendChild(a);
        navList.appendChild(li);
    });

    // Add logout button
    const logoutLi = document.createElement('li');
    logoutLi.className = 'logout-item';
    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = 'Cerrar sesión';
    logoutBtn.className = 'logout-btn';
    logoutBtn.addEventListener('click', async () => {
        try {
            await logout();
            window.location.href = './admin-login.html';
        } catch (error) {
            alert('Error al cerrar sesión');
        }
    });
    logoutLi.appendChild(logoutBtn);
    navList.appendChild(logoutLi);

    nav.appendChild(navList);

    // Insert at the beginning of body
    document.body.insertBefore(nav, document.body.firstChild);
}

// Auto-initialize if this script is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminNav);
} else {
    initAdminNav();
}

export function showToast(message) {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-3 rounded shadow-xl transform transition-all duration-300 translate-y-10 opacity-0 flex items-center space-x-3 pointer-events-auto`;
            toast.innerHTML = `<div class="bg-brand-light dark:bg-brand-dark p-1 rounded-full text-white"><i data-lucide="check" class="w-4 h-4"></i></div><span class="font-medium text-sm">${message}</span>`;
            
            container.appendChild(toast);
            lucide.createIcons();

            requestAnimationFrame(() => toast.classList.remove('translate-y-10', 'opacity-0'));
            setTimeout(() => {
                toast.classList.add('translate-y-10', 'opacity-0');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        \nwindow.showToast = showToast;\n
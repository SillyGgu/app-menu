export const iconStorage = {
    key: 'st_app_menu_custom_icons',
    
    save: function(data) {
        localStorage.setItem(this.key, JSON.stringify(data));
    },
    
    load: function() {
        const defaults = { icons: {}, sprite: { url: '', enabled: false, gridSize: 60 }, spriteOffsets: {} };
        try {
            const saved = JSON.parse(localStorage.getItem(this.key) || 'null');
            if (!saved || typeof saved !== 'object') return defaults;
            return {
                icons: saved.icons && typeof saved.icons === 'object' ? saved.icons : {},
                sprite: { ...defaults.sprite, ...(saved.sprite && typeof saved.sprite === 'object' ? saved.sprite : {}) },
                spriteOffsets: saved.spriteOffsets && typeof saved.spriteOffsets === 'object' ? saved.spriteOffsets : {}
            };
        } catch (error) {
            console.warn('[app-menu] 저장된 아이콘 설정을 읽지 못했습니다.', error);
            return defaults;
        }
    }
};

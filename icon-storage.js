export const iconStorage = {
    key: 'st_app_menu_custom_icons',
    
    save: function(data) {
        localStorage.setItem(this.key, JSON.stringify(data));
    },
    
    load: function() {
        const data = localStorage.getItem(this.key);
        return data ? JSON.parse(data) : { 
            icons: {}, // { appId: 'base64_image' }
            sprite: {
                url: '',
                enabled: false,
                gridSize: 60 // 기본 그리드 크기
            },
            spriteOffsets: {} // { appId: { r: 0, c: 0 } }
        };
    }
};
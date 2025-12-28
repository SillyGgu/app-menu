import {
    saveSettingsDebounced,
    eventSource,
    event_types
} from '../../../../script.js';
import {
    extension_settings,
    loadExtensionSettings
} from '../../../extensions.js';

(function() {
    const extensionName = "app-menu";
    let $iphoneContainer;
    let $globalTooltip;

    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = {
            bgImage: '',
            hiddenApps: []
        };
    }
    const settings = extension_settings[extensionName];

    async function createIphoneMenu() {
        if ($('#iphone-menu-container').length) return;

        const html = `
            <div id="iphone-menu-container">
                <div class="iphone-bg-blur-layer"></div> <div id="iphone-menu-header">
                    <span id="iphone-title">Extensions</span>
                    <div class="iphone-settings-toggle">
                        <i class="fa-solid fa-gear"></i>
                    </div>
                </div>
                <div id="iphone-menu-grid-view" class="iphone-view"></div>
                <div id="iphone-settings-view" class="iphone-view" style="display:none;">
                    <div class="setting-group">
                        <span class="setting-title">배경 이미지 URL</span>
                        <input type="text" id="bg-url-input" placeholder="URL 입력" value="${settings.bgImage}">
                    </div>
                    <div class="setting-group">
                        <span class="setting-title">앱 숨기기 설정</span>
                        <div id="app-visibility-list"></div>
                    </div>
                </div>
            </div>
            <div id="iphone-global-tooltip"></div>
        `;
        $('body').append(html);
        $iphoneContainer = $('#iphone-menu-container');
        $globalTooltip = $('#iphone-global-tooltip');

        applyBackground();

        $('.iphone-settings-toggle').on('click', function(e) {
            e.stopPropagation();
            const isSettingsVisible = $('#iphone-settings-view').is(':visible');
            if (isSettingsVisible) {
                $('#iphone-settings-view').hide();
                $('#iphone-menu-grid-view').show();
                $('#iphone-title').text('Extensions');
                $(this).find('i').attr('class', 'fa-solid fa-gear');
                refreshAppGrid();
            } else {
                $('#iphone-menu-grid-view').hide();
                $('#iphone-settings-view').show();
                $('#iphone-title').text('Settings');
                $(this).find('i').attr('class', 'fa-solid fa-xmark');
                renderVisibilitySettings();
            }
        });

        $('#bg-url-input').on('change', function() {
            settings.bgImage = $(this).val();
            applyBackground();
            saveSettingsDebounced();
        });

        $(document).on('mousedown', (e) => {
            if (!$iphoneContainer.is(e.target) && $iphoneContainer.has(e.target).length === 0 && !$(e.target).closest('#extensionsMenuButton').length) {
                $iphoneContainer.fadeOut(200);
                $globalTooltip.hide();
            }
        });
    }

    function applyBackground() {
        const $bgLayer = $('.iphone-bg-blur-layer');
        if (settings.bgImage) {
            $bgLayer.css('background-image', `url('${settings.bgImage}')`);
        } else {
            $bgLayer.css('background-image', 'none');
        }
    }
    function getAllMenuItems() {
        const items = [];
        $('#extensionsMenu .list-group-item').each(function() {
            const $item = $(this);
            
            // 1. 아이콘 추출 (자식 요소 전체에서 i 태그나 아이콘 클래스 검색)
            let iconClass = $item.find('i').first().attr('class') || 
                            $item.find('[class*="fa-"]').first().attr('class') ||
                            $item.find('.extensionsMenuExtensionButton').first().attr('class') ||
                            'fa-solid fa-cube';

            // 2. 텍스트(라벨) 추출 (우선순위 세분화)
            // 우선순위: .list-group-item-label -> span -> 직접 텍스트 노드 -> title 속성
            let label = '';
            
            if ($item.find('.list-group-item-label').length) {
                label = $item.find('.list-group-item-label').first().text().trim();
            } 
            
            if (!label && $item.find('span').length) {
                label = $item.find('span').first().text().trim();
            }
            
            if (!label) {
                label = $item.contents().filter(function() {
                    return this.nodeType === 3; // 순수 텍스트 노드
                }).text().trim();
            }
            
            label = label || $item.attr('title') || 'App';

            const id = $item.attr('id') || label; 
            
            items.push({
                id: id,
                label: label,
                iconClass: iconClass,
                originalElement: $item
            });
        });
        return items;
    }

    function refreshAppGrid() {
        const $view = $('#iphone-menu-grid-view');
        $view.empty();
        
        const allItems = getAllMenuItems();
        const visibleItems = allItems.filter(item => !settings.hiddenApps.includes(item.id));

        for (let i = 0; i < visibleItems.length; i += 3) {
            const $shelf = $('<div class="iphone-shelf"></div>');
            const rowItems = visibleItems.slice(i, i + 3);

            rowItems.forEach(item => {
                const $app = $(`
                    <div class="iphone-app-item">
                        <div class="iphone-app-icon">
                            <i class="${item.iconClass}"></i>
                        </div>
                        <div class="iphone-app-label">${item.label}</div>
                    </div>
                `);

                $app.on('click', (e) => {
                    e.stopPropagation();
                    item.originalElement.click();
                    $iphoneContainer.fadeOut(200);
                    $globalTooltip.hide();
                });

                $app.on('mouseenter', function() {
                    const rect = this.getBoundingClientRect();
                    $globalTooltip.text(item.label).css({
                        top: (rect.top - 40) + 'px',
                        left: (rect.left + rect.width / 2) + 'px',
                        display: 'block'
                    });
                });

                $app.on('mouseleave', () => $globalTooltip.hide());

                $shelf.append($app);
            });
            $view.append($shelf);
        }
    }

    function renderVisibilitySettings() {
        const $list = $('#app-visibility-list');
        $list.empty();
        const items = getAllMenuItems();

        items.forEach(item => {
            const isChecked = !settings.hiddenApps.includes(item.id);
            const $row = $(`
                <div class="setting-item">
                    <span style="font-size:12px; color:#333;">${item.label}</span>
                    <input type="checkbox" class="app-vis-check" data-id="${item.id}" ${isChecked ? 'checked' : ''}>
                </div>
            `);
            $list.append($row);
        });

        $('.app-vis-check').on('change', function() {
            const id = $(this).data('id');
            if (this.checked) {
                settings.hiddenApps = settings.hiddenApps.filter(a => a !== id);
            } else {
                if (!settings.hiddenApps.includes(id)) settings.hiddenApps.push(id);
            }
            saveSettingsDebounced();
        });
    }

    function init() {
        createIphoneMenu();
        $(document).on('click', '#extensionsMenuButton', function(e) {
            e.stopImmediatePropagation();
            
            // 이미 열려있으면 닫기, 닫혀있으면 열기
            if ($iphoneContainer.is(':visible')) {
                $iphoneContainer.fadeOut(200);
                $globalTooltip.hide();
            } else {
                $('#extensionsMenu').addClass('iphone-mode-active');
                refreshAppGrid();
                const rect = this.getBoundingClientRect();
                $iphoneContainer.css({ left: rect.left + 'px' }).fadeIn(200);
            }
        });
    }

    $(document).ready(() => {
        init();
    });
})();
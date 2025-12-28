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
            hiddenApps: [],
            pos: { top: 80, left: 20 },
            scale: 100,
            labelBold: true,
            bgBlur: 5,           // 희뿌연 정도
            bgOpacity: 0.4,      // 흰색 덮개 불투명도 (신규)
            iconOpacity: 1.0,    // 아이콘 투명도 (신규)
            fontSize: 10,        // 글자 크기 (신규)
            autoClose: true
        };
    }
    const settings = extension_settings[extensionName];

    async function createIphoneMenu() {
        if ($('#iphone-menu-container').length) return;

        const html = `
            <div id="iphone-menu-container">
                <div class="iphone-bg-blur-layer"></div>
                <div class="iphone-bg-overlay"></div> 
                <div id="iphone-menu-header">
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
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                            <span class="setting-title" style="margin:0;">앱 이름 볼드체</span>
                            <input type="checkbox" id="bold-toggle" ${settings.labelBold ? 'checked' : ''}>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span class="setting-title" style="margin:0;">외부 클릭 시 자동 닫기</span>
                            <input type="checkbox" id="autoclose-toggle" ${settings.autoClose ? 'checked' : ''}>
                        </div>
                    </div>

                    <div class="setting-group">
                        <span class="setting-title">메뉴 전체 크기: <span id="scale-value">${settings.scale}%</span></span>
                        <input type="range" id="menu-scale-slider" min="50" max="150" value="${settings.scale}" style="width: 100%;">
                    </div>

                    <div class="setting-group">
                        <span class="setting-title">배경 희뿌연 정도 (Blur): <span id="blur-value">${settings.bgBlur}px</span></span>
                        <input type="range" id="bg-blur-slider" min="0" max="30" step="1" value="${settings.bgBlur}" style="width: 100%;">
                    </div>

                    <div class="setting-group">
                        <span class="setting-title">흰색 배경 불투명도: <span id="opacity-value">${Math.round(settings.bgOpacity * 100)}%</span></span>
                        <input type="range" id="bg-opacity-slider" min="0" max="1" step="0.05" value="${settings.bgOpacity}" style="width: 100%;">
                    </div>

                    <div class="setting-group">
                        <span class="setting-title">아이콘 투명도: <span id="icon-opacity-value">${Math.round(settings.iconOpacity * 100)}%</span></span>
                        <input type="range" id="icon-opacity-slider" min="0.1" max="1" step="0.05" value="${settings.iconOpacity}" style="width: 100%;">
                    </div>

                    <div class="setting-group">
                        <span class="setting-title">텍스트 크기: <span id="font-size-value">${settings.fontSize}px</span></span>
                        <input type="range" id="font-size-slider" min="8" max="20" step="1" value="${settings.fontSize}" style="width: 100%;">
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
        applyCurrentPosition();

        bindDragFunctionality($iphoneContainer);

        // 설정 토글
        $('.iphone-settings-toggle').on('click', function(e) {
            e.stopPropagation();
            if ($('#iphone-settings-view').is(':visible')) {
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

        // 이벤트 바인딩
        $('#bold-toggle').on('change', function() { settings.labelBold = $(this).is(':checked'); saveSettingsDebounced(); });
        $('#autoclose-toggle').on('change', function() { settings.autoClose = $(this).is(':checked'); saveSettingsDebounced(); });

        $('#menu-scale-slider').on('input', function() {
            settings.scale = $(this).val();
            $('#scale-value').text(settings.scale + '%');
            applyCurrentPosition();
            saveSettingsDebounced();
        });

        $('#bg-blur-slider').on('input', function() {
            settings.bgBlur = $(this).val();
            $('#blur-value').text(settings.bgBlur + 'px');
            applyBackground();
            saveSettingsDebounced();
        });

        $('#bg-opacity-slider').on('input', function() {
            settings.bgOpacity = $(this).val();
            $('#opacity-value').text(Math.round(settings.bgOpacity * 100) + '%');
            applyBackground();
            saveSettingsDebounced();
        });

        $('#icon-opacity-slider').on('input', function() {
            settings.iconOpacity = $(this).val();
            $('#icon-opacity-value').text(Math.round(settings.iconOpacity * 100) + '%');
            refreshAppGrid(); // 아이콘에 즉시 반영
            saveSettingsDebounced();
        });

        $('#font-size-slider').on('input', function() {
            settings.fontSize = $(this).val();
            $('#font-size-value').text(settings.fontSize + 'px');
            refreshAppGrid(); // 텍스트 크기 즉시 반영
            saveSettingsDebounced();
        });

        $('#bg-url-input').on('change', function() {
            settings.bgImage = $(this).val();
            applyBackground();
            saveSettingsDebounced();
        });

        $(document).on('mousedown', (e) => {
            if (!settings.autoClose) return;
            if (!$iphoneContainer.is(e.target) && $iphoneContainer.has(e.target).length === 0 && !$(e.target).closest('#extensionsMenuButton').length) {
                $iphoneContainer.fadeOut(200);
                $globalTooltip.hide();
            }
        });
    }
    function applyBackground() {
        const $bgLayer = $('.iphone-bg-blur-layer');
        const $overlay = $('.iphone-bg-overlay');
        const blurVal = settings.bgBlur ?? 5;
        const opacityVal = settings.bgOpacity ?? 0.4;

        if (settings.bgImage) {
            $bgLayer.css({
                'background-image': `url('${settings.bgImage}')`,
                'filter': `blur(${blurVal}px)`
            });
            // 흰색 덮개의 투명도 조절
            $overlay.css('opacity', opacityVal);
        } else {
            $bgLayer.css({'background-image': 'none', 'filter': 'none'});
            $overlay.css('opacity', 0);
        }
    }
	
    function bindDragFunctionality($element) {
        let isDragging = false;
        let startX, startY;
        let initialLeft, initialTop;
        const container = $element[0];

        function onDragStart(e) {
            
            if (window.innerWidth <= 768) return;
            
            
            if (!$(e.target).closest('#iphone-menu-header').length) return;

            isDragging = true;
            $element.addClass('grabbing');
            
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = container.offsetLeft;
            initialTop = container.offsetTop;
        }

        function onDragMove(e) {
            if (!isDragging) return;

            let deltaX = e.clientX - startX;
            let deltaY = e.clientY - startY;

            let newLeft = initialLeft + deltaX;
            let newTop = initialTop + deltaY;

            container.style.left = `${newLeft}px`;
            container.style.top = `${newTop}px`;

            settings.pos.left = newLeft;
            settings.pos.top = newTop;
        }

        function onDragEnd() {
            if (isDragging) {
                isDragging = false;
                $element.removeClass('grabbing');
                saveSettingsDebounced();
            }
        }

        $element.on('mousedown', onDragStart);
        $(document).on('mousemove', onDragMove);
        $(document).on('mouseup', onDragEnd);
    }

    function applyCurrentPosition() {
        if (!$iphoneContainer) return;

        const scaleFactor = (settings.scale || 100) / 100;

        if (window.innerWidth <= 768) {
            // 모바일 환경
            const $chat = $('#chat');
            if ($chat.length > 0) {
                const rect = $chat[0].getBoundingClientRect();
                const mobileTopOffset = 70; 
                const centerX = rect.left + (rect.width / 2);

                $iphoneContainer.css({
                    'top': (rect.top + mobileTopOffset) + 'px',
                    'height': '500px', 
                    'left': centerX + 'px',
                    'transform': `translateX(-50%) scale(${scaleFactor})`, // 중앙 정렬과 스케일 동시 적용
                    'width': '280px', 
                    'bottom': 'auto',
                    'position': 'fixed',
                    'border-radius': '40px'
                });
            }
        } else {
            // 데스크탑 환경
            $iphoneContainer.css({
                'top': settings.pos.top + 'px',
                'left': settings.pos.left + 'px',
                'bottom': 'auto',
                'transform': `scale(${scaleFactor})`, // 설정된 비율 적용
                'width': '280px',
                'height': '500px',
                'position': 'fixed',
                'border-radius': '40px'
            });
        }
    }
    function getAllMenuItems() {
        const items = [];
        $('#extensionsMenu .list-group-item').each(function() {
            const $item = $(this);
            
            
            let iconClass = $item.find('i').first().attr('class') || 
                            $item.find('[class*="fa-"]').first().attr('class') ||
                            $item.find('.extensionsMenuExtensionButton').first().attr('class') ||
                            'fa-solid fa-cube';

            
            
            let label = '';
            
            if ($item.find('.list-group-item-label').length) {
                label = $item.find('.list-group-item-label').first().text().trim();
            } 
            
            if (!label && $item.find('span').length) {
                label = $item.find('span').first().text().trim();
            }
            
            if (!label) {
                label = $item.contents().filter(function() {
                    return this.nodeType === 3; 
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
        const boldClass = settings.labelBold ? 'is-bold' : '';
        const iconOpacity = settings.iconOpacity ?? 1.0;
        const fontSize = settings.fontSize ?? 10;

        for (let i = 0; i < visibleItems.length; i += 3) {
            const $shelf = $('<div class="iphone-shelf"></div>');
            const rowItems = visibleItems.slice(i, i + 3);

            rowItems.forEach(item => {
                const $app = $(`
                    <div class="iphone-app-item">
                        <div class="iphone-app-icon" style="opacity: ${iconOpacity};">
                            <i class="${item.iconClass}"></i>
                        </div>
                        <div class="iphone-app-label ${boldClass}" style="font-size: ${fontSize}px;">${item.label}</div>
                    </div>
                `);

                $app.on('click', (e) => {
                    e.stopPropagation();
                    item.originalElement.click();
                    if (settings.autoClose) {
                        $iphoneContainer.fadeOut(200);
                        $globalTooltip.hide();
                    }
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
            
            if ($iphoneContainer.is(':visible')) {
                $iphoneContainer.fadeOut(200);
                $globalTooltip.hide();
            } else {
                $('#extensionsMenu').addClass('iphone-mode-active');
                refreshAppGrid();
                applyCurrentPosition(); 
                $iphoneContainer.fadeIn(200);
            }
        });

        
        $(window).on('resize', () => {
            if ($iphoneContainer.is(':visible')) {
                applyCurrentPosition();
            }
        });
    }

    $(document).ready(() => {
        init();
    });
})();
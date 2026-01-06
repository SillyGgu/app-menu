import {
    saveSettingsDebounced,
    eventSource,
    event_types
} from '../../../../script.js';
import {
    extension_settings,
    loadExtensionSettings
} from '../../../extensions.js';
import { iconStorage } from './icon-storage.js';

let customIconData = iconStorage.load();

(function() {
    const extensionName = "app-menu";
    let $iphoneContainer;
    let $globalTooltip;
    let cropperState = {
        img: null,
        appId: null,
        zoom: 1,
        x: 0,
        y: 0,
        isDragging: false,
        startX: 0,
        startY: 0
    };

    function startCropping(file, appId) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                cropperState.img = img;
                cropperState.appId = appId;
                cropperState.zoom = 1;
                cropperState.x = 0;
                cropperState.y = 0;
                $('#iphone-cropper-modal').fadeIn(200);
                drawCropper();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function drawCropper() {
        const canvas = document.getElementById('cropper-canvas');
        const ctx = canvas.getContext('2d');
        const size = 300;
        canvas.width = size;
        canvas.height = size;

        ctx.clearRect(0, 0, size, size);
        const iw = cropperState.img.width * cropperState.zoom;
        const ih = cropperState.img.height * cropperState.zoom;
        
        ctx.drawImage(cropperState.img, (size - iw)/2 + cropperState.x, (size - ih)/2 + cropperState.y, iw, ih);
    }

    
    function bindCropperEvents() {
        $('#cropper-zoom').on('input', function() {
            cropperState.zoom = parseFloat($(this).val());
            drawCropper();
        });

        
        $('#cropper-canvas').on('mousedown', (e) => {
            cropperState.isDragging = true;
            cropperState.startX = e.clientX - cropperState.x;
            cropperState.startY = e.clientY - cropperState.y;
        });

        
        $('#cropper-canvas').on('touchstart', (e) => {
            const touch = e.touches[0];
            cropperState.isDragging = true;
            cropperState.startX = touch.clientX - cropperState.x;
            cropperState.startY = touch.clientY - cropperState.y;
            
            if (e.cancelable) e.preventDefault();
        });

        $(document).on('mousemove touchmove', (e) => {
            if (!cropperState.isDragging) return;
            
            let clientX, clientY;
            if (e.type === 'touchmove') {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
                
                if (e.cancelable) e.preventDefault();
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            cropperState.x = clientX - cropperState.startX;
            cropperState.y = clientY - cropperState.startY;
            drawCropper();
        });

        $(document).on('mouseup touchend', () => { 
            cropperState.isDragging = false; 
        });

        $('#cropper-save').on('click', () => {
            const canvas = document.getElementById('cropper-canvas');
            const base64 = canvas.toDataURL('image/png');
            $('body').css('cursor', 'default');
            customIconData.icons[cropperState.appId] = base64;
            iconStorage.save(customIconData);
            $('#iphone-cropper-modal').fadeOut(200);
            setTimeout(() => {
                renderVisibilitySettings();
                refreshAppGrid();
            }, 50);
        });

        $('#cropper-cancel').on('click', () => $('#iphone-cropper-modal').fadeOut(200));
    }
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = {
            bgImage: '',
            hiddenApps: [],
            appOrder: [],      
            pos: { top: 80, left: 20 },
            scale: 100,
            labelBold: true,
            bgBlur: 5,
            bgOpacity: 0.4,
            iconOpacity: 1.0,
            fontSize: 10,
            autoClose: true,
            spriteXOffset: 0
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
                        <span class="setting-title">전체 어플 덮어씌우기</span>
                        <input type="text" id="sprite-url-input" placeholder="스프라이트 이미지 URL" value="${customIconData.sprite.url}">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                            <span style="font-size:11px;">스프라이트 모드 활성화</span>
                            <input type="checkbox" id="sprite-enable-toggle" ${customIconData.sprite.enabled ? 'checked' : ''}>
                        </div>
                    </div>

                    <div class="setting-group">
                        <span class="setting-title">스프라이트 좌우 위치 조절: <span id="sprite-x-value">${settings.spriteXOffset}px</span></span>
                        <input type="range" id="sprite-x-slider" min="-100" max="100" step="1" value="${settings.spriteXOffset}" style="width: 100%;">
                        <div style="display:flex; justify-content:space-between; font-size:10px; color:#888; margin-top:5px;">
                            <span>Left</span>
                            <span>Center (0)</span>
                            <span>Right</span>
                        </div>
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
                        <span class="setting-title">배경 희뿌연 정도: <span id="blur-value">${settings.bgBlur}px</span></span>
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
        const cropperHtml = `
            <div id="iphone-cropper-modal" style="display:none;">
                <div class="cropper-content">
                    <div class="cropper-header">이미지 자르기</div>
                    <div class="cropper-canvas-container">
                        <canvas id="cropper-canvas"></canvas>
                        <div class="cropper-overlay"></div>
                    </div>
                    <div class="cropper-controls">
                        <input type="range" id="cropper-zoom" min="0.1" max="3" step="0.01" value="1">
                        <div class="cropper-btns">
                            <button id="cropper-cancel">취소</button>
                            <button id="cropper-save">적용</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        $('body').append(cropperHtml);
        $iphoneContainer = $('#iphone-menu-container');
        $globalTooltip = $('#iphone-global-tooltip');

        applyBackground();
        applyCurrentPosition();

        bindDragFunctionality($iphoneContainer);

        
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
            refreshAppGrid(); 
            saveSettingsDebounced();
        });

        $('#font-size-slider').on('input', function() {
            settings.fontSize = $(this).val();
            $('#font-size-value').text(settings.fontSize + 'px');
            refreshAppGrid(); 
            saveSettingsDebounced();
        });
        $('#sprite-x-slider').on('input', function() {
            settings.spriteXOffset = parseInt($(this).val());
            $('#sprite-x-value').text(settings.spriteXOffset + 'px');
            refreshAppGrid(); 
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
            
            const $chat = $('#chat');
            if ($chat.length > 0) {
                const rect = $chat[0].getBoundingClientRect();
                const mobileTopOffset = 70; 
                
                
                const centerX = rect.left + (rect.width / 2);

                $iphoneContainer.css({
                    'top': (rect.top + mobileTopOffset) + 'px',
                    'height': '500px', 
                    'left': centerX + 'px', 
                    'bottom': 'auto',
                    'position': 'fixed',
                    'border-radius': '40px',
                    'width': '280px',
                    
                    'transform-origin': 'top center',
                    'transform': `translateX(-50%) scale(${scaleFactor})`
                });
            }
        } else {
            
            $iphoneContainer.css({
                'top': settings.pos.top + 'px',
                'left': settings.pos.left + 'px',
                'bottom': 'auto',
                'width': '280px',
                'height': '500px',
                'position': 'fixed',
                'border-radius': '40px',
                'transform-origin': 'top left',
                'transform': `scale(${scaleFactor})`
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

        
        if (!settings.appOrder) settings.appOrder = [];
        
        
        items.forEach(item => {
            if (!settings.appOrder.includes(item.id)) {
                settings.appOrder.push(item.id);
            }
        });

        
        const currentIds = items.map(i => i.id);
        settings.appOrder = settings.appOrder.filter(id => currentIds.includes(id));

        
        items.sort((a, b) => {
            return settings.appOrder.indexOf(a.id) - settings.appOrder.indexOf(b.id);
        });

        return items;
    }

function refreshAppGrid() {
        const $view = $('#iphone-menu-grid-view');
        $view.empty();
        
        customIconData = iconStorage.load();
        
        const allItems = getAllMenuItems();
        const visibleItems = allItems.filter(item => !settings.hiddenApps.includes(item.id));
        const boldClass = settings.labelBold ? 'is-bold' : '';
        const iconOpacity = settings.iconOpacity ?? 1.0;
        const fontSize = settings.fontSize ?? 10;

        
        const SPRITE_X_OFFSET = settings.spriteXOffset ?? 0; 
        const SHELF_HEIGHT = 90;     
        const ICON_SIZE = 60;        
        const SIDE_MARGIN = 20;      
        const GAP = 30;              

        
        const totalRows = Math.ceil(visibleItems.length / 3);
        const totalGridHeight = totalRows * SHELF_HEIGHT;
        

        for (let i = 0; i < visibleItems.length; i += 3) {
            const rowIndex = Math.floor(i / 3);
            const $shelf = $('<div class="iphone-shelf"></div>');
            const rowItems = visibleItems.slice(i, i + 3);

            rowItems.forEach((item, colIndex) => {
                let iconContent = '';
                
                
                if (customIconData.icons[item.id]) {
                    iconContent = `<img src="${customIconData.icons[item.id]}" style="width:100%; height:100%; object-fit:cover; border-radius:14px; display:block;">`;
                } 
                
                else if (customIconData.sprite.enabled && customIconData.sprite.url) {
                    
                    const iconLeftPos = SIDE_MARGIN + (colIndex * (ICON_SIZE + GAP));
                    const posY = (rowIndex * SHELF_HEIGHT) + 15; 

                    iconContent = `<div style="
                        width: 60px !important; 
                        height: 60px !important; 
                        background-image: url('${customIconData.sprite.url}') !important;
                        
                        background-size: auto ${totalGridHeight}px !important; 
                        background-position: -${iconLeftPos - SPRITE_X_OFFSET}px -${posY}px !important;
                        background-repeat: no-repeat !important;
                        border-radius: 14px !important;
                        display: block !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                    "></div>`;
                } 
                
                else {
                    iconContent = `<i class="${item.iconClass}"></i>`;
                }

                const $app = $(`
                    <div class="iphone-app-item">
                        <div class="iphone-app-icon" style="opacity: ${iconOpacity};">
                            ${iconContent}
                        </div>
                        <div class="iphone-app-label ${boldClass}" style="font-size: ${fontSize}px; width: 60px;">${item.label}</div>
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
        
        
        $list.off('click');
        $list.off('change');

        
        $list.on('click', '.app-info-trigger', function() {
            $(this).closest('.setting-item-container').find('.app-detail-settings').stop().slideToggle(200);
        });

        
        $list.on('change', '.app-vis-check', function() {
            const id = $(this).data('id');
            if (this.checked) {
                settings.hiddenApps = settings.hiddenApps.filter(a => a !== id);
            } else {
                if (!settings.hiddenApps.includes(id)) settings.hiddenApps.push(id);
            }
            saveSettingsDebounced();
        });

        
        $list.on('click', '.order-btn', function(e) {
            e.stopPropagation();
            const id = $(this).data('id');
            const direction = $(this).hasClass('up') ? -1 : 1;
            const currentIndex = settings.appOrder.indexOf(id);
            const newIndex = currentIndex + direction;

            if (newIndex >= 0 && newIndex < settings.appOrder.length) {
                
                const temp = settings.appOrder[currentIndex];
                settings.appOrder[currentIndex] = settings.appOrder[newIndex];
                settings.appOrder[newIndex] = temp;
                
                saveSettingsDebounced();
                renderVisibilitySettings(); 
                refreshAppGrid();           
            }
        });

        
        $list.on('click', '.icon-upload-btn', function() {
            const appId = $(this).data('id');
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) startCropping(file, appId);
            };
            input.click();
        });

        
        $list.on('click', '.icon-reset-btn', function() {
            const appId = $(this).data('id');
            delete customIconData.icons[appId];
            iconStorage.save(customIconData);
            renderVisibilitySettings();
            refreshAppGrid();
        });

        
        $list.on('change', '.sprite-row, .sprite-col', function() {
            const $container = $(this).closest('.setting-item-container');
            const appId = $container.data('app-id');
            const r = parseInt($container.find('.sprite-row').val()) || 0;
            const c = parseInt($container.find('.sprite-col').val()) || 0;
            
            customIconData.spriteOffsets[appId] = { r, c };
            iconStorage.save(customIconData);
            refreshAppGrid();
        });

        $list.empty();
        customIconData = iconStorage.load();
        const items = getAllMenuItems();

        items.forEach(item => {
            const isChecked = !settings.hiddenApps.includes(item.id);
            const customIcon = customIconData.icons[item.id];
            const offset = customIconData.spriteOffsets[item.id] || { r: 0, c: 0 };
            
            const $row = $(`
                <div class="setting-item-container" data-app-id="${item.id}">
                    <div class="setting-item main-row">
                        <div class="order-controls" style="display:flex; flex-direction:column; margin-right:10px;">
                            <div class="order-btn up" data-id="${item.id}" style="cursor:pointer; padding:2px;"><i class="fa-solid fa-caret-up"></i></div>
                            <div class="order-btn down" data-id="${item.id}" style="cursor:pointer; padding:2px;"><i class="fa-solid fa-caret-down"></i></div>
                        </div>
                        <div class="app-info-trigger" style="flex:1; cursor:pointer; display:flex; align-items:center;">
                            <div class="mini-preview" id="prev-${item.id}">
                                ${customIcon ? `<img src="${customIcon}">` : `<i class="${item.iconClass}"></i>`}
                            </div>
                            <span style="font-size:12px; color:#333;">${item.label}</span>
                        </div>
                        <input type="checkbox" class="app-vis-check" data-id="${item.id}" ${isChecked ? 'checked' : ''}>
                    </div>
                    <div class="app-detail-settings" style="display:none; padding: 10px; background: rgba(0,0,0,0.03); border-radius: 10px; margin-bottom:10px;">
                        <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
                            <button class="icon-upload-btn" data-id="${item.id}">이미지 변경</button>
                            <button class="icon-reset-btn" data-id="${item.id}">초기화</button>
                        </div>
                        <div class="sprite-offset-settings">
                            <span style="font-size:11px;">스프라이트 좌표 (행/열):</span>
                            <input type="number" class="sprite-row" value="${offset.r}" style="width:40px;">
                            <input type="number" class="sprite-col" value="${offset.c}" style="width:40px;">
                        </div>
                    </div>
                </div>
            `);
            $list.append($row);
        });
    }

    function init() {
        createIphoneMenu();
        bindCropperEvents(); 

        
        $('#sprite-url-input').on('change', function() {
            customIconData.sprite.url = $(this).val();
            iconStorage.save(customIconData);
            refreshAppGrid();
        });

        
        $('#sprite-enable-toggle').on('change', function() {
            customIconData.sprite.enabled = $(this).is(':checked');
            iconStorage.save(customIconData);
            refreshAppGrid();
        });
        
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
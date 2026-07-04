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
    let $settingsModal;
    let $globalTooltip;
    let menuObserver;
    let refreshTimer;
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
        if (!canvas || !cropperState.img) return;
        const ctx = canvas.getContext('2d');
        const size = 300;
        
        // 캔버스 크기 고정
        canvas.width = size;
        canvas.height = size;

        ctx.clearRect(0, 0, size, size);
        
        // 배경을 검은색으로 채워 빈 공간이 투명하게 보이지 않게 함
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, size, size);

        const iw = cropperState.img.width * cropperState.zoom;
        const ih = cropperState.img.height * cropperState.zoom;
        
        const drawX = (size - iw) / 2 + cropperState.x;
        const drawY = (size - ih) / 2 + cropperState.y;
        
        ctx.drawImage(cropperState.img, drawX, drawY, iw, ih);
    }

    
    function bindCropperEvents() {
        const canvas = document.getElementById('cropper-canvas');

        $('#cropper-zoom').on('input', function() {
            cropperState.zoom = parseFloat($(this).val());
            drawCropper();
        });

        const getPointerPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        $('#cropper-canvas').on('mousedown touchstart', (e) => {
            cropperState.isDragging = true;
            const pos = getPointerPos(e.originalEvent || e);
            cropperState.startX = pos.x - cropperState.x;
            cropperState.startY = pos.y - cropperState.y;
            if (e.cancelable) e.preventDefault();
        });

        $(document).on('mousemove touchmove', (e) => {
            if (!cropperState.isDragging) return;
            
            const pos = getPointerPos(e.originalEvent || e);
            cropperState.x = pos.x - cropperState.startX;
            cropperState.y = pos.y - cropperState.startY;
            drawCropper();
            
            if (e.cancelable && e.type === 'touchmove') e.preventDefault();
        });

        $(document).on('mouseup touchend', () => { 
            cropperState.isDragging = false; 
        });

        $('#cropper-save').on('click', () => {
            const canvas = document.getElementById('cropper-canvas');
            // 최종적으로 캔버스에 보이는 그대로를 base64로 추출
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
		extension_settings[extensionName] = {};
	}
	const _s = extension_settings[extensionName];
	if (_s.bgImage === undefined)      _s.bgImage = '';
	if (_s.hiddenApps === undefined)   _s.hiddenApps = [];
	if (_s.appOrder === undefined)     _s.appOrder = [];
	if (_s.pos === undefined)          _s.pos = { top: 80, left: 20 };
	if (_s.scale === undefined)        _s.scale = 100;
	if (_s.labelBold === undefined)    _s.labelBold = true;
	if (_s.bgBlur === undefined)       _s.bgBlur = 5;
	if (_s.bgOpacity === undefined)    _s.bgOpacity = 0.4;
	if (_s.iconOpacity === undefined)  _s.iconOpacity = 1.0;
	if (_s.fontSize === undefined)     _s.fontSize = 10;
	if (_s.autoClose === undefined)    _s.autoClose = true;
	if (_s.spriteXOffset === undefined) _s.spriteXOffset = 0;
	if (_s.frameColor === undefined)   _s.frameColor = '#101114';
    const settings = extension_settings[extensionName];

    async function createIphoneMenu() {
        if ($('#iphone-menu-container').length) return;

        const html = `
            <div id="iphone-menu-container">
                <div class="iphone-screen-backdrop">
                    <div class="iphone-bg-blur-layer"></div>
                    <div class="iphone-bg-overlay"></div>
                </div>


                <div id="iphone-drag-handle">
                    <div id="iphone-status-bar">
                        <span id="iphone-time">9:41</span>
                        <div id="iphone-status-icons">
                            <i class="fa-solid fa-signal"></i>
                            <i class="fa-solid fa-wifi"></i>
                            <i class="fa-solid fa-battery-full"></i>
                        </div>
                    </div>
                    <div id="iphone-notch"></div>

                    <div id="iphone-menu-header">
                        <span id="iphone-title">Extensions</span>
                        <div class="iphone-settings-toggle">
                            <i class="fa-solid fa-gear"></i>
                        </div>
                    </div>
                </div>


                <div id="iphone-menu-grid-view" class="iphone-view"></div>
                <div id="iphone-settings-view" class="iphone-view" style="display:none;">
                    <div class="setting-group">
                        <span class="setting-title">배경 이미지 URL</span>
                        <input type="text" id="bg-url-input" placeholder="URL 입력" value="${settings.bgImage}">
                    </div>
                    <div class="setting-group">
                        <span class="setting-title">폰 프레임 컬러</span>
                        <div class="frame-color-picker">
                            <div id="frame-color-preview" class="frame-color-preview"></div>
                            <div class="frame-color-controls">
                                <div id="frame-color-area" class="frame-color-area">
                                    <div id="frame-color-area-thumb" class="frame-color-thumb"></div>
                                </div>
                                <div id="frame-hue-strip" class="frame-hue-strip">
                                    <div id="frame-hue-thumb" class="frame-hue-thumb"></div>
                                </div>
                                <div id="frame-color-swatches" class="frame-color-swatches"></div>
                                <input type="text" id="frame-color-hex" value="${settings.frameColor}" maxlength="7" spellcheck="false">
                            </div>
                        </div>
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

                <div id="iphone-home-indicator-container">
                    <div id="iphone-home-indicator"></div>
                </div>

            </div>
            <div id="iphone-global-tooltip"></div>
        `;
        $('body').append(html);
        $('body').append(`
            <div id="iphone-settings-modal" style="display:none;">
                <div id="iphone-settings-panel">
                    <div id="iphone-settings-header">
                        <span>Settings</span>
                        <button type="button" id="iphone-settings-close" title="Close">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div id="iphone-settings-content"></div>
                </div>
            </div>
        `);
        $('#iphone-settings-content').append($('#iphone-settings-view').removeClass('iphone-view').show());
		
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
        $settingsModal = $('#iphone-settings-modal');
        $globalTooltip = $('#iphone-global-tooltip');

        applyBackground();
        applyFrameColor();
        applyCurrentPosition();

        bindDragFunctionality($iphoneContainer);

        
        $('.iphone-settings-toggle').on('click', function(e) {
            e.stopPropagation();
            openSettingsModal();
        });

        $('#iphone-settings-close').on('click', closeSettingsModal);
        $settingsModal.on('mousedown', function(e) {
            if (e.target === this) closeSettingsModal();
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

        bindFrameColorPicker();

        $(document).on('mousedown', (e) => {
            if (!settings.autoClose) return;
            if ($settingsModal && ($settingsModal.is(e.target) || $settingsModal.has(e.target).length > 0)) return;
            if ($('#iphone-cropper-modal').is(':visible')) return;
            if (!$iphoneContainer.is(e.target) && $iphoneContainer.has(e.target).length === 0 && !$(e.target).closest('#extensionsMenuButton').length) {
                $iphoneContainer.fadeOut(200);
                $globalTooltip.hide();
            }
        });
    }

    function openSettingsModal() {
        renderVisibilitySettings();
        positionSettingsModal();
        $settingsModal.stop(true, true).css({ display: 'flex', opacity: 0 }).animate({ opacity: 1 }, 160);
    }

    function closeSettingsModal() {
        if (!$settingsModal) return;
        $settingsModal.stop(true, true).animate({ opacity: 0 }, 160, function() {
            $settingsModal.hide();
            refreshAppGrid();
        });
    }

    function positionSettingsModal() {
        if (!$settingsModal) return;

        const host = getSettingsHostElement();
        const rect = host ? host.getBoundingClientRect() : {
            top: 0,
            left: 0,
            width: window.innerWidth,
            height: window.innerHeight
        };

        const padding = 10;
        const top = Math.max(padding, rect.top + padding);
        const left = Math.max(padding, rect.left + padding);
        const right = Math.min(window.innerWidth - padding, rect.right - padding);
        const bottom = Math.min(window.innerHeight - padding, rect.bottom - padding);

        $settingsModal.css({
            top: `${top}px`,
            left: `${left}px`,
            width: `${Math.max(0, right - left)}px`,
            height: `${Math.max(0, bottom - top)}px`
        });
    }

    function getSettingsHostElement() {
        const selectors = ['#chat', '#sheld', '#chat-block', '#main-content', 'body'];
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (!element) continue;

            const rect = element.getBoundingClientRect();
            if (rect.width > 320 && rect.height > 360) {
                return element;
            }
        }
        return null;
    }

    function scheduleMenuRefresh() {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
            refreshAppGrid();
            if ($settingsModal && $settingsModal.is(':visible')) {
                renderVisibilitySettings();
            }
        }, 150);
    }

    function bindMenuObserver() {
        const menu = document.getElementById('extensionsMenu');
        if (!menu || menuObserver) return;

        menuObserver = new MutationObserver(scheduleMenuRefresh);
        menuObserver.observe(menu, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'title']
        });
    }

    function rescanMenu() {
        bindMenuObserver();
        scheduleMenuRefresh();
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
            $overlay.css('opacity', 0.96);
        }
    }

    function applyFrameColor() {
        const color = normalizeHexColor(settings.frameColor) || '#101114';
        settings.frameColor = color;
        document.documentElement.style.setProperty('--app-menu-frame-color', color);
        if ($iphoneContainer) {
            $iphoneContainer.css('--phone-frame-color', color);
        }
        $('#frame-color-preview').css({ background: color, color: color });
        $('#frame-color-hex').val(color);
    }

    function bindFrameColorPicker() {
        const swatches = ['#101114', '#f8f8fa', '#475569', '#0f766e', '#7c3aed', '#be123c', '#c2410c', '#facc15'];
        const $swatches = $('#frame-color-swatches');
        const area = document.getElementById('frame-color-area');
        const areaThumb = document.getElementById('frame-color-area-thumb');
        const hueStrip = document.getElementById('frame-hue-strip');
        const hueThumb = document.getElementById('frame-hue-thumb');
        let picker = hexToHsv(settings.frameColor);

        $swatches.empty();
        swatches.forEach(color => {
            const $button = $(`<button type="button" class="frame-color-swatch" aria-label="${color}" style="background:${color}"></button>`);
            $button.on('click', () => setFrameColor(color));
            $swatches.append($button);
        });

        function syncPicker(color) {
            picker = hexToHsv(color);
            const hueColor = hsvToHex(picker.h, 100, 100);
            $(area).css('background-color', hueColor);
            areaThumb.style.left = `${picker.s}%`;
            areaThumb.style.top = `${100 - picker.v}%`;
            hueThumb.style.left = `${picker.h / 360 * 100}%`;
        }

        function setFrameColor(color) {
            const normalized = normalizeHexColor(color);
            if (!normalized) return;
            settings.frameColor = normalized;
            applyFrameColor();
            syncPicker(normalized);
            saveSettingsDebounced();
        }

        function updateFromArea(e) {
            const rect = area.getBoundingClientRect();
            const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
            const y = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
            picker.s = Math.round((x / rect.width) * 100);
            picker.v = Math.round(100 - (y / rect.height) * 100);
            setFrameColor(hsvToHex(picker.h, picker.s, picker.v));
        }

        function updateFromHue(e) {
            const rect = hueStrip.getBoundingClientRect();
            const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
            picker.h = Math.round((x / rect.width) * 360);
            setFrameColor(hsvToHex(picker.h, picker.s, picker.v));
        }

        function bindPointerDrag(element, onMove) {
            element.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                element.setPointerCapture(e.pointerId);
                onMove(e);
            });
            element.addEventListener('pointermove', (e) => {
                if (e.buttons !== 1) return;
                onMove(e);
            });
        }

        syncPicker(settings.frameColor);
        bindPointerDrag(area, updateFromArea);
        bindPointerDrag(hueStrip, updateFromHue);
        $('#frame-color-hex').on('change', function() {
            setFrameColor($(this).val());
        });
    }

    function normalizeHexColor(value) {
        const raw = String(value || '').trim();
        const full = raw.startsWith('#') ? raw : `#${raw}`;
        const shortMatch = full.match(/^#([0-9a-f]{3})$/i);
        if (shortMatch) {
            return `#${shortMatch[1].split('').map(ch => ch + ch).join('')}`.toLowerCase();
        }
        return /^#[0-9a-f]{6}$/i.test(full) ? full.toLowerCase() : null;
    }

    function hexToHsv(hex) {
        const normalized = normalizeHexColor(hex) || '#101114';
        const r = parseInt(normalized.slice(1, 3), 16) / 255;
        const g = parseInt(normalized.slice(3, 5), 16) / 255;
        const b = parseInt(normalized.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        let h = 0;

        if (delta !== 0) {
            if (max === r) h = 60 * (((g - b) / delta) % 6);
            else if (max === g) h = 60 * ((b - r) / delta + 2);
            else h = 60 * ((r - g) / delta + 4);
        }

        if (h < 0) h += 360;
        return {
            h: Math.round(h),
            s: max === 0 ? 0 : Math.round((delta / max) * 100),
            v: Math.round(max * 100)
        };
    }

    function hsvToHex(h, s, v) {
        s /= 100;
        v /= 100;
        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;
        let r = 0, g = 0, b = 0;

        if (h < 60) [r, g, b] = [c, x, 0];
        else if (h < 120) [r, g, b] = [x, c, 0];
        else if (h < 180) [r, g, b] = [0, c, x];
        else if (h < 240) [r, g, b] = [0, x, c];
        else if (h < 300) [r, g, b] = [x, 0, c];
        else [r, g, b] = [c, 0, x];

        const toHex = val => Math.round((val + m) * 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    function hexToHsl(hex) {
        const normalized = normalizeHexColor(hex) || '#101114';
        const r = parseInt(normalized.slice(1, 3), 16) / 255;
        const g = parseInt(normalized.slice(3, 5), 16) / 255;
        const b = parseInt(normalized.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
        }

        return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
    }

    function hslToHex(h, s, l) {
        s /= 100;
        l /= 100;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        let r = 0, g = 0, b = 0;

        if (h < 60) [r, g, b] = [c, x, 0];
        else if (h < 120) [r, g, b] = [x, c, 0];
        else if (h < 180) [r, g, b] = [0, c, x];
        else if (h < 240) [r, g, b] = [0, x, c];
        else if (h < 300) [r, g, b] = [x, 0, c];
        else [r, g, b] = [c, 0, x];

        const toHex = val => Math.round((val + m) * 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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
        const seen = new Set();
        const candidates = $('#extensionsMenu .list-group-item, #extensionsMenu .extensionsMenuExtensionButton, #extensionsMenu .interactable, #extensionsMenu button, #extensionsMenu [role="button"], #extensionsMenu [tabindex]');

        candidates.each(function() {
            const $item = $(this);
            if (!$item.closest('#extensionsMenu').length) return;
            if ($item.closest('#iphone-menu-container, #iphone-settings-modal').length) return;
            if ($item.parentsUntil('#extensionsMenu').filter('.list-group-item, .extensionsMenuExtensionButton, button, [role="button"]').length) return;

            const labelFromChild = $item.find('.list-group-item-label, .menu_button, .menu-label, span').first().text().trim();
            const labelFromText = $item.text().replace(/\s+/g, ' ').trim();
            let label = labelFromChild ||
                ($item.attr('aria-label') || '').trim() ||
                ($item.attr('title') || '').trim() ||
                ($item.attr('data-name') || '').trim() ||
                ($item.attr('data-extension-name') || '').trim() ||
                labelFromText;

            if (!label && !$item.attr('id')) return;
            const id = getStableAppId($item, label || 'App');
            if (seen.has(id)) return;
            seen.add(id);

            let iconClass = $item.find('i').first().attr('class') || 
                            $item.find('[class*="fa-"]').first().attr('class') ||
                            $item.find('.extensionsMenuExtensionButton').first().attr('class') ||
                            'fa-solid fa-cube';
            
            items.push({
                id: id,
                label: label || 'App',
                iconClass: iconClass,
                originalElement: $item
            });
        });

        
        if (!settings.appOrder) settings.appOrder = [];

        // appOrder에 없는 신규 항목은 맨 뒤에 추가
        items.forEach(item => {
            if (!settings.appOrder.includes(item.id)) {
                settings.appOrder.push(item.id);
            }
        });

        // appOrder 기준으로 정렬
        items.sort((a, b) => {
            return settings.appOrder.indexOf(a.id) - settings.appOrder.indexOf(b.id);
        });

        return items;
    }

    function getStableAppId($item, fallbackLabel) {
        const attrs = ['id', 'data-extension-name', 'data-name', 'data-module', 'data-i18n', 'title', 'aria-label'];
        for (const attr of attrs) {
            const value = ($item.attr(attr) || '').trim();
            if (value) return value;
        }

        const href = ($item.attr('href') || '').trim();
        if (href && href !== '#') return href;

        return fallbackLabel.trim();
    }

    function activateOriginalItem($item) {
        const element = $item && $item[0];
        if (!element) return;

        element.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        }));
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
        const SIDE_MARGIN = 17;      
        const GAP = 24;              

        
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
                    activateOriginalItem(item.originalElement);
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
                        <div class="drag-handle" draggable="true" title="Drag to reorder">
                            <i class="fa-solid fa-grip-vertical"></i>
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

        // 드래그 앤 드롭 순서 변경
        let dragSrcEl = null;
        let dragOverEl = null;

        $list.find('.setting-item-container').each(function() {
            const el = this;
            const handle = $(el).find('.drag-handle')[0];

            function clearDragState() {
                dragSrcEl = null;
                dragOverEl = null;
                $list.find('.setting-item-container').removeClass('is-dragging drag-over');
            }

            handle.addEventListener('dragstart', function(e) {
                e.stopPropagation();
                dragSrcEl = this;
                dragOverEl = null;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', $(el).data('app-id'));
                $(el).addClass('is-dragging');
            });
			
            handle.addEventListener('dragend', clearDragState);
            el.addEventListener('dragend', clearDragState);

            el.addEventListener('dragover', function(e) {
                const sourceContainer = dragSrcEl ? $(dragSrcEl).closest('.setting-item-container')[0] : null;
                if (!sourceContainer || sourceContainer === this) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverEl !== this) {
                    if (dragOverEl) $(dragOverEl).removeClass('drag-over');
                    dragOverEl = this;
                    $(this).addClass('drag-over');
                }
                return false;
            });

            el.addEventListener('dragleave', function() {
                if (dragOverEl === this) {
                    $(this).removeClass('drag-over');
                    dragOverEl = null;
                }
            });

            el.addEventListener('drop', function(e) {
                e.stopPropagation();
                e.preventDefault();
                $list.find('.setting-item-container').removeClass('drag-over');
                const sourceContainer = dragSrcEl ? $(dragSrcEl).closest('.setting-item-container')[0] : null;
                if (!sourceContainer || sourceContainer === this) return;

                const fromId = $(dragSrcEl).closest('.setting-item-container').data('app-id');
                const toId = $(this).data('app-id');

                const fromIdx = settings.appOrder.indexOf(fromId);
                const toIdx = settings.appOrder.indexOf(toId);

                if (fromIdx !== -1 && toIdx !== -1) {
                    settings.appOrder.splice(fromIdx, 1);
                    settings.appOrder.splice(toIdx, 0, fromId);
                    saveSettingsDebounced();
                    renderVisibilitySettings();
                    refreshAppGrid();
                }
                return false;
            });
        });
    }

    function init() {
        createIphoneMenu();
        bindCropperEvents(); 
        bindMenuObserver();

        
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
                bindMenuObserver();
                scheduleMenuRefresh();
                applyCurrentPosition(); 
                $iphoneContainer.fadeIn(200);
            }
        });

        
        $(window).on('resize', () => {
            if ($iphoneContainer.is(':visible')) {
                applyCurrentPosition();
            }
            if ($settingsModal && $settingsModal.is(':visible')) {
                positionSettingsModal();
            }
        });
    }

    $(document).ready(() => {
        init();
        setTimeout(rescanMenu, 500);
        setTimeout(rescanMenu, 1500);
        setTimeout(rescanMenu, 3000);
    });
})();

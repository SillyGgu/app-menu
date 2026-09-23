import { iconStorage } from './icon-storage.js';

let customIconData = iconStorage.load();

(function() {
    const { extensionSettings: extension_settings, saveSettingsDebounced, Popup, POPUP_TYPE } = SillyTavern.getContext();
    const extensionName = "app-menu";
    let $iphoneContainer;
    let $settingsStorage;
    let settingsPopup;
    let $globalTooltip;
    let menuObserver;
    let refreshTimer;
    let menuSignature = '';
    let gridRefreshPending = false;
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
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
        if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
            toastr.error('PNG, JPG, WebP 또는 GIF 이미지를 선택해 주세요.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                cropperState.img = img;
                cropperState.appId = appId;
                cropperState.zoom = 1;
                cropperState.x = 0;
                cropperState.y = 0;
                $('#cropper-zoom').val(1);
                document.getElementById('iphone-cropper-modal').showModal();
                drawCropper();
            };
            img.onerror = () => toastr.error('이미지를 열 수 없습니다. 다른 파일을 선택해 주세요.');
            img.src = e.target.result;
        };
        reader.onerror = () => toastr.error('이미지 파일을 읽지 못했습니다.');
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

        const baseScale = Math.max(size / cropperState.img.width, size / cropperState.img.height);
        const iw = cropperState.img.width * baseScale * cropperState.zoom;
        const ih = cropperState.img.height * baseScale * cropperState.zoom;
        
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
            return {
                x: (e.clientX - rect.left) * canvas.width / rect.width,
                y: (e.clientY - rect.top) * canvas.height / rect.height
            };
        };

        canvas.addEventListener('pointerdown', e => {
            cropperState.isDragging = true;
            canvas.setPointerCapture(e.pointerId);
            const pos = getPointerPos(e);
            cropperState.startX = pos.x - cropperState.x;
            cropperState.startY = pos.y - cropperState.y;
            e.preventDefault();
        });

        canvas.addEventListener('pointermove', e => {
            if (!cropperState.isDragging) return;
            const pos = getPointerPos(e);
            cropperState.x = pos.x - cropperState.startX;
            cropperState.y = pos.y - cropperState.startY;
            drawCropper();
        });

        const endCropDrag = () => {
            cropperState.isDragging = false; 
        };
        canvas.addEventListener('pointerup', endCropDrag);
        canvas.addEventListener('pointercancel', endCropDrag);

        $('#cropper-save').on('click', () => {
            const canvas = document.getElementById('cropper-canvas');
            // 최종적으로 캔버스에 보이는 그대로를 base64로 추출
            const base64 = canvas.toDataURL('image/jpeg', 0.84);
            $('body').css('cursor', 'default');
            const previousIcon = customIconData.icons[cropperState.appId];
            customIconData.icons[cropperState.appId] = base64;
            try {
                iconStorage.save(customIconData);
            } catch (error) {
                if (previousIcon) customIconData.icons[cropperState.appId] = previousIcon;
                else delete customIconData.icons[cropperState.appId];
                toastr.error('아이콘을 저장할 공간이 부족합니다. 기존 아이콘을 정리해 주세요.');
                return;
            }
            document.getElementById('iphone-cropper-modal').close();
            setTimeout(() => {
                renderVisibilitySettings();
                requestGridRefresh();
            }, 50);
        });

        $('#cropper-cancel').on('click', () => document.getElementById('iphone-cropper-modal').close());
    }
	if (!extension_settings[extensionName]) {
		extension_settings[extensionName] = {};
	}
	const _s = extension_settings[extensionName];
	if (_s.bgImage === undefined)      _s.bgImage = '';
	if (_s.hiddenApps === undefined)   _s.hiddenApps = [];
	if (_s.appOrder === undefined)     _s.appOrder = [];
	if (!_s.pos || typeof _s.pos !== 'object') _s.pos = { top: 80, left: 20 };
	if (_s.scale === undefined)        _s.scale = 100;
	if (_s.labelBold === undefined)    _s.labelBold = true;
	if (_s.bgBlur === undefined)       _s.bgBlur = 5;
	if (_s.bgOpacity === undefined)    _s.bgOpacity = 0.4;
	if (_s.iconOpacity === undefined)  _s.iconOpacity = 1.0;
	if (_s.fontSize === undefined)     _s.fontSize = 10;
	if (_s.autoClose === undefined)    _s.autoClose = true;
	if (_s.spriteXOffset === undefined) _s.spriteXOffset = 0;
	if (_s.frameColor === undefined)   _s.frameColor = '#101114';
    if (!_s.appNames || typeof _s.appNames !== 'object' || Array.isArray(_s.appNames)) _s.appNames = {};
    if (!Array.isArray(_s.hiddenApps)) _s.hiddenApps = [];
    if (!Array.isArray(_s.appOrder)) _s.appOrder = [];
    if (!Array.isArray(_s.folders)) _s.folders = [];
    _s.folders = _s.folders.filter(folder => folder && typeof folder.id === 'string' && Array.isArray(folder.appIds))
        .map(folder => ({ id: folder.id, name: String(folder.name || '새 폴더').slice(0, 40), appIds: [...new Set(folder.appIds.filter(id => typeof id === 'string'))] }));
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
                        <span id="iphone-title">앱 메뉴</span>
                        <div class="iphone-settings-toggle" role="button" tabindex="0" aria-label="앱 메뉴 설정" title="앱 메뉴 설정">
                            <i class="fa-solid fa-gear"></i>
                        </div>
                    </div>
                </div>


                <div id="iphone-menu-grid-view" class="iphone-view"></div>
                <div id="iphone-folder-view" hidden>
                    <button type="button" id="iphone-folder-back" aria-label="폴더 닫기"><i class="fa-solid fa-chevron-left"></i> 앱 메뉴</button>
                    <div id="iphone-folder-name"></div>
                    <div id="iphone-folder-apps"></div>
                </div>
                <div id="iphone-settings-view" class="iphone-view" style="display:none;">
                    <div class="setting-group">
                        <span class="setting-title">배경 이미지 URL</span>
                        <input type="url" id="bg-url-input" placeholder="https://..." value="${escapeHtml(settings.bgImage)}">
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
                                <input type="text" id="frame-color-hex" value="${escapeHtml(settings.frameColor)}" maxlength="7" spellcheck="false">
                            </div>
                        </div>
                    </div>
                    <div class="setting-group">
                        <span class="setting-title">전체 어플 덮어씌우기</span>
                        <input type="url" id="sprite-url-input" placeholder="스프라이트 이미지 URL" value="${escapeHtml(customIconData.sprite.url)}">
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
                        <div class="app-management-header"><span class="setting-title">앱 관리</span><div class="app-management-actions"><select id="app-filter" aria-label="앱 표시 필터"><option value="all">전체 앱</option><option value="visible">표시된 앱</option><option value="hidden">미표시 앱</option></select><button type="button" id="add-folder-btn"><i class="fa-solid fa-folder-plus"></i> 폴더 추가</button></div></div>
                        <p class="setting-help">앱의 이름·아이콘·표시 여부와 순서를 바꾸고 폴더에 정리하세요.</p>
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
            <div id="iphone-settings-storage" style="display:none;">
                <div id="iphone-settings-popup-content" class="iphone-settings-popup">
                    <div class="iphone-settings-popup-title"><span>앱 메뉴 설정</span><small>화면과 앱을 원하는 방식으로 정리하세요</small></div>
                    <div id="iphone-settings-content"></div>
                </div>
            </div>
        `);
        $('#iphone-settings-content').append($('#iphone-settings-view').removeClass('iphone-view').show());
		
        const cropperHtml = `
            <dialog id="iphone-cropper-modal" aria-label="앱 아이콘 편집">
                <div class="cropper-content">
                        <div class="cropper-header">앱 아이콘 편집 <small>사진을 움직이고 확대해 정사각형으로 자르세요</small></div>
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
            </dialog>
        `;
        $('body').append(cropperHtml);
        $iphoneContainer = $('#iphone-menu-container');
        $settingsStorage = $('#iphone-settings-storage');
        $globalTooltip = $('#iphone-global-tooltip');

        applyLauncherTypography();
        applyBackground();
        applyFrameColor();
        applyCurrentPosition();

        bindDragFunctionality($iphoneContainer);

        
        $('.iphone-settings-toggle').on('click keydown', function(e) {
            if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            openSettingsModal();
        });

        
        $('#bold-toggle').on('change', function() {
            settings.labelBold = $(this).is(':checked');
            $('#iphone-menu-grid-view .iphone-app-label').toggleClass('is-bold', settings.labelBold);
            saveSettingsDebounced();
        });
        $('#autoclose-toggle').on('change', function() { settings.autoClose = $(this).is(':checked'); saveSettingsDebounced(); });

        $('#menu-scale-slider').on('input', function() {
            settings.scale = $(this).val();
            $('#scale-value').text(settings.scale + '%');
        }).on('change', function() {
            applyCurrentPosition();
            saveSettingsDebounced();
        });

        $('#bg-blur-slider').on('input', function() {
            settings.bgBlur = $(this).val();
            $('#blur-value').text(settings.bgBlur + 'px');
        }).on('change', function() {
            applyBackground();
            saveSettingsDebounced();
        });

        $('#bg-opacity-slider').on('input', function() {
            settings.bgOpacity = $(this).val();
            $('#opacity-value').text(Math.round(settings.bgOpacity * 100) + '%');
        }).on('change', function() {
            applyBackground();
            saveSettingsDebounced();
        });

        $('#icon-opacity-slider').on('input', function() {
            settings.iconOpacity = $(this).val();
            $('#icon-opacity-value').text(Math.round(settings.iconOpacity * 100) + '%');
            applyLauncherTypography();
        }).on('change', function() {
            saveSettingsDebounced();
        });

        $('#font-size-slider').on('input', function() {
            settings.fontSize = $(this).val();
            $('#font-size-value').text(settings.fontSize + 'px');
            applyLauncherTypography();
        }).on('change', function() {
            saveSettingsDebounced();
        });
        $('#sprite-x-slider').on('input', function() {
            settings.spriteXOffset = parseInt($(this).val());
            $('#sprite-x-value').text(settings.spriteXOffset + 'px');
        }).on('change', function() {
            requestGridRefresh();
            saveSettingsDebounced();
        });
        $('#bg-url-input').on('change', function() {
            settings.bgImage = $(this).val();
            applyBackground();
            saveSettingsDebounced();
        });

        bindFrameColorPicker();

        $(document).on('pointerdown.appMenu', (e) => {
            if (!settings.autoClose) return;
            if (settingsPopup) return;
            if ($('#iphone-cropper-modal').is(':visible')) return;
            if (!$iphoneContainer.is(e.target) && $iphoneContainer.has(e.target).length === 0 && !$(e.target).closest('#extensionsMenuButton').length) {
                $iphoneContainer.fadeOut(200);
                $globalTooltip.hide();
            }
        });
    }

    function openSettingsModal() {
        if (settingsPopup) return;

        renderVisibilitySettings();
        const content = document.getElementById('iphone-settings-popup-content');
        settingsPopup = new Popup(content, POPUP_TYPE.DISPLAY, '', {
            wider: true,
            allowVerticalScrolling: true,
            onOpen: popup => {
                popup.dlg.classList.add('iphone-settings-popup-dialog');
                popup.body.classList.add('iphone-settings-popup-body');
                popup.content.classList.add('iphone-settings-popup-host');
            },
            onClose: () => {
                $settingsStorage.append(content);
                settingsPopup = null;
                if (gridRefreshPending) {
                    gridRefreshPending = false;
                    refreshAppGrid();
                }
            }
        });
        settingsPopup.show();
    }

    function closeSettingsModal() {
        if (!settingsPopup) return;
        settingsPopup.completeCancelled();
    }

    function requestGridRefresh() {
        if (settingsPopup) {
            gridRefreshPending = true;
            return;
        }
        refreshAppGrid();
    }

    function scheduleMenuRefresh() {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
            const signature = getAllMenuItems().map(item => `${item.id}:${item.label}:${item.iconClass}`).join('|');
            if (signature === menuSignature) return;
            menuSignature = signature;
            requestGridRefresh();
            if (settingsPopup) {
                renderVisibilitySettings();
            }
        }, 150);
    }

    function bindMenuObserver() {
        const menu = document.getElementById('extensionsMenu');
        if (!menu || menuObserver) return;

        menu.classList.add('iphone-mode-active');
        menuObserver = new MutationObserver(scheduleMenuRefresh);
        menuObserver.observe(menu, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'title', 'aria-label', 'data-i18n']
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
                'background-image': `url(${JSON.stringify(settings.bgImage)})`,
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

        function setFrameColor(color, persist = true) {
            const normalized = normalizeHexColor(color);
            if (!normalized) return;
            settings.frameColor = normalized;
            applyFrameColor();
            syncPicker(normalized);
            if (persist) saveSettingsDebounced();
        }

        function updateFromArea(e) {
            const rect = area.getBoundingClientRect();
            const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
            const y = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
            picker.s = Math.round((x / rect.width) * 100);
            picker.v = Math.round(100 - (y / rect.height) * 100);
            setFrameColor(hsvToHex(picker.h, picker.s, picker.v), false);
        }

        function updateFromHue(e) {
            const rect = hueStrip.getBoundingClientRect();
            const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
            picker.h = Math.round((x / rect.width) * 360);
            setFrameColor(hsvToHex(picker.h, picker.s, picker.v), false);
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
            element.addEventListener('pointerup', () => saveSettingsDebounced());
            element.addEventListener('pointercancel', () => saveSettingsDebounced());
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
            
            
            if (!$(e.target).closest('#iphone-menu-header').length || $(e.target).closest('button, [role="button"]').length) return;

            isDragging = true;
            $element.addClass('grabbing');
            
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = container.offsetLeft;
            initialTop = container.offsetTop;
            container.setPointerCapture(e.pointerId);
        }

        function onDragMove(e) {
            if (!isDragging) return;

            let deltaX = e.clientX - startX;
            let deltaY = e.clientY - startY;

            let newLeft = initialLeft + deltaX;
            let newTop = initialTop + deltaY;

            const scale = Number(settings.scale) / 100 || 1;
            newLeft = Math.min(Math.max(8, newLeft), Math.max(8, window.innerWidth - 280 * scale - 8));
            newTop = Math.min(Math.max(8, newTop), Math.max(8, window.innerHeight - 500 * scale - 8));
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

        $element.on('pointerdown', onDragStart);
        $element.on('pointermove', onDragMove);
        $element.on('pointerup pointercancel', onDragEnd);
    }

    function applyLauncherTypography() {
        if (!$iphoneContainer) return;
        $iphoneContainer.css({
            '--am-app-font-size': `${Number(settings.fontSize) || 10}px`,
            '--am-icon-opacity': String(settings.iconOpacity ?? 1)
        });
    }

    function applyCurrentPosition() {
        if (!$iphoneContainer) return;

        const scaleFactor = Math.min(1.5, Math.max(0.5, Number(settings.scale) / 100 || 1));

        if (window.innerWidth <= 768) {
            
            const $chat = $('#chat');
            if ($chat.length > 0) {
                const rect = $chat[0].getBoundingClientRect();
                const mobileTopOffset = 70;
                
                
                const centerX = rect.left + (rect.width / 2);

                const mobileScale = Math.min(scaleFactor, (window.innerWidth - 24) / 280, (window.innerHeight - 16) / 500);
                const mobileTop = Math.max(8, Math.min(rect.top + mobileTopOffset, window.innerHeight - 500 * mobileScale - 8));
                $iphoneContainer.css({
                    'top': mobileTop + 'px',
                    'height': '500px',
                    'left': centerX + 'px', 
                    'bottom': 'auto',
                    'position': 'fixed',
                    'border-radius': '40px',
                    'width': '280px',
                    
                    'transform-origin': 'top center',
                    'transform': `translateX(-50%) scale(${mobileScale})`
                });
            }
        } else {
            
            const left = Math.min(Math.max(8, Number(settings.pos.left) || 20), Math.max(8, window.innerWidth - 280 * scaleFactor - 8));
            const top = Math.min(Math.max(8, Number(settings.pos.top) || 80), Math.max(8, window.innerHeight - 500 * scaleFactor - 8));
            $iphoneContainer.css({
                'top': top + 'px',
                'left': left + 'px',
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
        const candidates = $('#extensionsMenu .list-group-item, #extensionsMenu .extensionsMenuExtensionButton, #extensionsMenu .interactable, #extensionsMenu button, #extensionsMenu [role="button"], #extensionsMenu [tabindex], #extensionsMenu a');

        candidates.each(function() {
            const $item = $(this);
            if (!$item.closest('#extensionsMenu').length) return;
            if ($item.closest('#iphone-menu-container, #iphone-settings-popup-content, .iphone-settings-popup-dialog').length) return;
            if ($item.parentsUntil('#extensionsMenu').filter('.list-group-item, .extensionsMenuExtensionButton, button, [role="button"], a').length) return;
            for (let node = this; node && node.id !== 'extensionsMenu'; node = node.parentElement) {
                const style = getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden') return;
            }

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
        let orderChanged = false;
        items.forEach(item => {
            if (!settings.appOrder.includes(item.id)) {
                settings.appOrder.push(item.id);
                orderChanged = true;
            }
        });
        if (orderChanged) saveSettingsDebounced();

        // appOrder 기준으로 정렬
        const order = new Map(settings.appOrder.map((id, index) => [id, index]));
        items.sort((a, b) => order.get(a.id) - order.get(b.id));

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

    function topLevelOrder() {
        const assigned = new Set(settings.folders.flatMap(folder => folder.appIds));
        const folderIds = new Set(settings.folders.map(folder => folderToken(folder.id)));
        const liveApps = new Set(getAllMenuItems().map(item => item.id));
        return settings.appOrder.filter(id => folderIds.has(id) ||
            liveApps.has(id) && !assigned.has(id) &&
            (appFilter === 'all' || (appFilter === 'visible' ? !settings.hiddenApps.includes(id) : settings.hiddenApps.includes(id))));
    }

    function reorderTopLevel(fromId, toId) {
        const fromIdx = settings.appOrder.indexOf(fromId);
        const toIdx = settings.appOrder.indexOf(toId);
        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
        settings.appOrder.splice(fromIdx, 1);
        settings.appOrder.splice(settings.appOrder.indexOf(toId), 0, fromId);
        saveSettingsDebounced(); renderVisibilitySettings(); requestGridRefresh();
    }

    function moveAppOrder(appId, delta) {
        const folder = appId.startsWith('folder:') ? null : appFolder(appId);
        const currentIds = folder ? folder.appIds : topLevelOrder();
        const fromIdx = currentIds.indexOf(appId);
        const toIdx = fromIdx + delta;
        if (fromIdx < 0 || toIdx < 0 || toIdx >= currentIds.length) return;
        const otherId = currentIds[toIdx];
        const order = folder ? folder.appIds : settings.appOrder;
        const orderFrom = order.indexOf(appId);
        const orderTo = order.indexOf(otherId);
        [order[orderFrom], order[orderTo]] = [order[orderTo], order[orderFrom]];
        saveSettingsDebounced();
        renderVisibilitySettings();
        requestGridRefresh();
    }

    function folderToken(id) { return `folder:${id}`; }

    function createAppIcon(item, className = 'iphone-app-icon') {
        const $icon = $('<div></div>').addClass(className);
        if (customIconData.icons[item.id]) $('<img alt="">').attr('src', customIconData.icons[item.id]).appendTo($icon);
        else $('<i></i>').addClass(item.iconClass).appendTo($icon);
        return $icon;
    }

    function appFolder(appId) { return settings.folders.find(folder => folder.appIds.includes(appId)); }

    function moveAppToFolder(appId, folderId, items = getAllMenuItems()) {
        if (!items.some(item => item.id === appId)) return;
        const target = folderId ? settings.folders.find(folder => folder.id === folderId) : null;
        if (folderId && !target) return;
        settings.folders.forEach(folder => { folder.appIds = folder.appIds.filter(id => id !== appId); });
        if (target) target.appIds.push(appId);
        saveSettingsDebounced();
        renderVisibilitySettings();
        requestGridRefresh();
    }

    function openFolder(folder, itemMap, hidden) {
        const $view = $('#iphone-folder-view');
        $('#iphone-folder-name').text(folder.name);
        const $apps = $('#iphone-folder-apps').empty();
        folder.appIds.forEach(id => {
            const item = itemMap.get(id);
            if (!item || hidden.has(id)) return;
            const name = settings.appNames[id] || item.label;
            const $app = $('<div class="iphone-app-item" role="button" tabindex="0"></div>')
                .attr('aria-label', name)
                .append(createAppIcon(item), $('<div class="iphone-app-label"></div>').toggleClass('is-bold', settings.labelBold).text(name));
            $app.on('click', e => {
                e.stopPropagation();
                activateOriginalItem(item.originalElement);
                if (settings.autoClose) { $iphoneContainer.fadeOut(200); $globalTooltip.hide(); }
            }).on('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $app.trigger('click'); } });
            $apps.append($app);
        });
        $view.prop('hidden', false);
        $('#iphone-menu-grid-view').hide();
        $('#iphone-folder-back').off('click').on('click', () => { $view.prop('hidden', true); $('#iphone-menu-grid-view').show(); });
    }

function refreshAppGrid() {
        const $view = $('#iphone-menu-grid-view');
        $view.empty();
        $('#iphone-folder-view').prop('hidden', true);
        $view.show();
        
        const allItems = getAllMenuItems();
        const hidden = new Set(settings.hiddenApps);
        const itemMap = new Map(allItems.map(item => [item.id, item]));
        const assigned = new Set(settings.folders.flatMap(folder => folder.appIds));
        const folderMap = new Map(settings.folders.map(folder => [folderToken(folder.id), folder]));
        const order = [...settings.appOrder];
        settings.folders.forEach(folder => { if (!order.includes(folderToken(folder.id))) order.push(folderToken(folder.id)); });
        const visibleItems = order.flatMap(id => {
            if (folderMap.has(id)) return [{ folder: folderMap.get(id) }];
            const item = itemMap.get(id);
            return item && !hidden.has(id) && !assigned.has(id) ? [item] : [];
        });
        const boldClass = settings.labelBold ? 'is-bold' : '';

        
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
                if (item.folder) {
                    const folder = item.folder;
                    const $mosaic = $('<div class="iphone-folder-icon"></div>');
                    folder.appIds.filter(id => itemMap.has(id) && !hidden.has(id)).slice(0, 4)
                        .forEach(id => $mosaic.append(createAppIcon(itemMap.get(id), 'iphone-folder-mini-icon')));
                    const $folder = $('<div class="iphone-app-item iphone-folder-item" role="button" tabindex="0"></div>')
                        .attr('aria-label', `${folder.name} 폴더 열기`)
                        .append($mosaic, $('<div class="iphone-app-label"></div>').toggleClass('is-bold', settings.labelBold).text(folder.name));
                    $folder.on('click', e => { e.stopPropagation(); openFolder(folder, itemMap, hidden); });
                    $folder.on('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $folder.trigger('click'); } });
                    $shelf.append($folder);
                    return;
                }
                const $icon = $('<div class="iphone-app-icon"></div>');
                if (customIconData.icons[item.id]) {
                    $('<img alt="">').attr('src', customIconData.icons[item.id]).appendTo($icon);
                } else if (customIconData.sprite.enabled && customIconData.sprite.url) {
                    
                    const iconLeftPos = SIDE_MARGIN + (colIndex * (ICON_SIZE + GAP));
                    const posY = (rowIndex * SHELF_HEIGHT) + 15; 
                    const offset = customIconData.spriteOffsets[item.id] || { r: 0, c: 0 };
                    const spriteX = iconLeftPos - SPRITE_X_OFFSET + (Number(offset.c) || 0) * (ICON_SIZE + GAP);
                    const spriteY = posY + (Number(offset.r) || 0) * SHELF_HEIGHT;

                    $('<div class="iphone-sprite-icon"></div>').css({
                        backgroundImage: `url(${JSON.stringify(customIconData.sprite.url)})`,
                        backgroundSize: `auto ${totalGridHeight}px`,
                        backgroundPosition: `${-spriteX}px ${-spriteY}px`
                    }).appendTo($icon);
                } else {
                    $('<i></i>').addClass(item.iconClass).appendTo($icon);
                }

                const displayName = settings.appNames[item.id] || item.label;
                const $app = $('<div class="iphone-app-item" role="button" tabindex="0"></div>')
                    .attr('aria-label', displayName)
                    .append($icon, $('<div class="iphone-app-label"></div>').addClass(boldClass).text(displayName));

                $app.on('click', (e) => {
                    e.stopPropagation();
                    activateOriginalItem(item.originalElement);
                    if (settings.autoClose) {
                        $iphoneContainer.fadeOut(200);
                        $globalTooltip.hide();
                    }
                });
                $app.on('keydown', e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        $app.trigger('click');
                    }
                });

                $app.on('mouseenter', function() {
                    const rect = this.getBoundingClientRect();
                    $globalTooltip.text(displayName).css({
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
	
    const openFolderIds = new Set();
    const openPickerIds = new Set();
    let appFilter = 'all';

    function renderFolders(items) {
        $('#app-filter').val(appFilter).off('change').on('change', function() {
            appFilter = this.value;
            renderVisibilitySettings();
        });
        $('#add-folder-btn').off('click').on('click', () => {
            const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            settings.folders.push({ id, name: '새 폴더', appIds: [] });
            settings.appOrder.push(folderToken(id));
            openFolderIds.add(id);
            saveSettingsDebounced(); renderVisibilitySettings(); requestGridRefresh();
            $('#app-visibility-list .folder-row').filter((_, el) => $(el).data('folder-id') === id)
                .find('.folder-name-input').trigger('focus').trigger('select');
        });
        const rows = new Map();
        settings.folders.forEach(folder => {
            const token = folderToken(folder.id);
            const expanded = openFolderIds.has(folder.id);
            const $row = $('<div class="folder-row"></div>').data('folder-id', folder.id).data('order-id', token);
            const $top = $('<div class="folder-row-top"></div>').appendTo($row);
            const $handle = $('<div class="drag-handle" draggable="true" title="폴더 순서 변경"><i class="fa-solid fa-grip-vertical"></i></div>').appendTo($top);
            $handle.on('dragstart', e => { e.stopPropagation(); e.originalEvent.dataTransfer.effectAllowed = 'move'; e.originalEvent.dataTransfer.setData('text/plain', token); $row.addClass('is-dragging'); })
                .on('dragend', () => $row.removeClass('is-dragging drag-over'));
            const $controls = $('<div class="mobile-order-controls" aria-label="폴더 순서 변경"></div>').appendTo($top);
            ['up', 'down'].forEach(direction => $('<button type="button" class="mobile-order-btn"></button>')
                .data('direction', direction).attr('title', direction === 'up' ? '위로 이동' : '아래로 이동')
                .append($('<i></i>').addClass(direction === 'up' ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'))
                .appendTo($controls));
            const $toggle = $('<button type="button" class="folder-toggle"></button>').attr('aria-expanded', String(expanded)).appendTo($top);
            $('<i class="fa-solid fa-folder folder-row-icon" aria-hidden="true"></i>').appendTo($toggle);
            $('<span class="folder-row-name"></span>').text(folder.name).appendTo($toggle);
            $('<span class="folder-count"></span>').text(`${folder.appIds.length}개`).appendTo($toggle);
            $('<i class="fa-solid fa-chevron-down folder-chevron" aria-hidden="true"></i>').appendTo($toggle);
            $toggle.on('click', () => {
                const open = !openFolderIds.has(folder.id);
                if (open) openFolderIds.add(folder.id); else openFolderIds.delete(folder.id);
                $toggle.attr('aria-expanded', String(open));
                $body.prop('hidden', !open);
            });
            const $body = $('<div class="folder-contents"></div>').prop('hidden', !expanded).appendTo($row);
            const $edit = $('<div class="folder-edit-row"></div>').appendTo($body);
            $('<label class="folder-name-label">폴더 이름</label>').append(
                $('<input type="text" class="folder-name-input" maxlength="40">').val(folder.name).on('input change', function() {
                    folder.name = String(this.value).slice(0, 40) || '새 폴더';
                    $toggle.find('.folder-row-name').text(folder.name);
                    requestGridRefresh();
                }).on('change', function() {
                    saveSettingsDebounced();
                })
            ).appendTo($edit);
            $('<button type="button" class="folder-delete-btn" aria-label="폴더 삭제"><i class="fa-solid fa-trash"></i></button>')
                .appendTo($edit).on('click', () => {
                    settings.folders = settings.folders.filter(entry => entry.id !== folder.id);
                    settings.appOrder = settings.appOrder.filter(id => id !== token);
                    openFolderIds.delete(folder.id); openPickerIds.delete(folder.id);
                    saveSettingsDebounced(); renderVisibilitySettings(); requestGridRefresh();
                });
            $('<div class="folder-items"></div>').appendTo($body);
            $('<button type="button" class="folder-select-btn"><i class="fa-solid fa-plus"></i> 앱 추가</button>')
                .appendTo($body).attr('aria-expanded', String(openPickerIds.has(folder.id))).on('click', function() {
                    const open = !openPickerIds.has(folder.id);
                    if (open) openPickerIds.add(folder.id); else openPickerIds.delete(folder.id);
                    $picker.prop('hidden', !open);
                    if (open) populatePicker();
                    $(this).attr('aria-expanded', String(open));
                });
            const $picker = $('<div class="folder-app-picker"></div>').prop('hidden', !openPickerIds.has(folder.id)).appendTo($body);
            function populatePicker() {
                $picker.empty();
                items.filter(item => !folder.appIds.includes(item.id)).forEach(item => {
                    const name = settings.appNames[item.id] || item.label;
                    $('<button type="button" class="folder-add-app"></button>').text(`+ ${name}`).appendTo($picker)
                        .on('click', () => moveAppToFolder(item.id, folder.id, items));
                });
            }
            if (openPickerIds.has(folder.id)) populatePicker();
            $row.on('dragover', e => { e.preventDefault(); e.originalEvent.dataTransfer.dropEffect = 'move'; $row.addClass('drag-over'); })
                .on('dragleave', () => $row.removeClass('drag-over'))
                .on('drop', e => {
                    e.preventDefault(); e.stopPropagation(); $row.removeClass('drag-over');
                    const id = e.originalEvent.dataTransfer.getData('text/plain');
                    if (id.startsWith('folder:')) reorderTopLevel(id, token);
                    else moveAppToFolder(id, folder.id, items);
                });
            rows.set(token, $row);
        });
        return rows;
    }

    function renderVisibilitySettings() {
        const $list = $('#app-visibility-list');
        const $scroller = $('#iphone-settings-content');
        const scrollTop = $scroller.scrollTop();
        const expandedId = $list.find('.app-info-trigger[aria-expanded="true"]').closest('.setting-item-container').data('app-id');

        $list.off('click');
        $list.off('change');

        $list.on('click', '.app-info-trigger', function() {
            const $row = $(this).closest('.setting-item-container');
            const $detail = $row.find('.app-detail-settings');
            const expanded = $(this).attr('aria-expanded') === 'true';
            if (!expanded) {
                const $preview = $detail.find('.app-icon-preview');
                if (!$preview.children().length) {
                    const id = $row.data('app-id');
                    if (customIconData.icons[id]) $('<img alt="">').attr('src', customIconData.icons[id]).appendTo($preview);
                    else $('<i></i>').addClass($row.data('icon-class')).appendTo($preview);
                }
            }
            $(this).attr('aria-expanded', String(!expanded));
            $detail.prop('hidden', expanded);
        });

        $list.on('change', '.app-vis-check', function() {
            const id = $(this).data('id');
            if (this.checked) {
                settings.hiddenApps = settings.hiddenApps.filter(a => a !== id);
            } else {
                if (!settings.hiddenApps.includes(id)) settings.hiddenApps.push(id);
            }
            saveSettingsDebounced();
            requestGridRefresh();
        });

        $list.on('input', '.app-name-input', function() {
            const appId = $(this).closest('.setting-item-container').data('app-id');
            const name = String($(this).val()).trim().slice(0, 40);
            if (this.value.length > 40) this.value = name;
            if (name) settings.appNames[appId] = name;
            else delete settings.appNames[appId];
            const $row = $(this).closest('.setting-item-container');
            const displayName = name || $(this).data('original-name');
            $row.find('.app-row-name').text(displayName);
            $row.find('.app-info-trigger').attr('aria-label', `${displayName} 편집`);
            $row.find('.app-vis-check').attr('aria-label', `${displayName} 표시`);
            requestGridRefresh();
        });

        $list.on('change', '.app-name-input', () => saveSettingsDebounced());

        $list.on('click', '.app-name-reset-btn', function() {
            const $row = $(this).closest('.setting-item-container');
            $row.find('.app-name-input').val('').trigger('input').trigger('change');
        });

        $list.on('click', '.icon-upload-btn', function() {
            const appId = $(this).closest('.setting-item-container').data('app-id');
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/png,image/jpeg,image/webp,image/gif';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) startCropping(file, appId);
            };
            input.click();
        });

        $list.on('click', '.icon-reset-btn', function() {
            const appId = $(this).closest('.setting-item-container').data('app-id');
            delete customIconData.icons[appId];
            iconStorage.save(customIconData);
            renderVisibilitySettings();
            requestGridRefresh();
        });

        $list.on('change', '.sprite-row, .sprite-col', function() {
            const $container = $(this).closest('.setting-item-container');
            const appId = $container.data('app-id');
            const r = parseInt($container.find('.sprite-row').val()) || 0;
            const c = parseInt($container.find('.sprite-col').val()) || 0;
            customIconData.spriteOffsets[appId] = { r, c };
            iconStorage.save(customIconData);
            requestGridRefresh();
        });

        $list.on('click', '.mobile-order-btn', function(e) {
            e.stopPropagation();
            const $entry = $(this).closest('.setting-item-container, .folder-row');
            const appId = $entry.data('order-id') || $entry.data('app-id');
            const direction = $(this).data('direction');
            moveAppOrder(appId, direction === 'up' ? -1 : 1);
        });

        $list.empty();
        const items = getAllMenuItems();
        const folderRows = renderFolders(items);
        const appRows = new Map();

        items.forEach(item => {
            const isChecked = !settings.hiddenApps.includes(item.id);
            const customIcon = customIconData.icons[item.id];
            const offset = customIconData.spriteOffsets[item.id] || { r: 0, c: 0 };

            const $row = $(`
                <div class="setting-item-container">
                    <div class="setting-item main-row">
                        <div class="drag-handle" draggable="true" title="Drag to reorder">
                            <i class="fa-solid fa-grip-vertical"></i>
                        </div>
                        <div class="mobile-order-controls" aria-label="순서 변경">
                            <button type="button" class="mobile-order-btn" data-direction="up" title="위로 이동">
                                <i class="fa-solid fa-chevron-up"></i>
                            </button>
                            <button type="button" class="mobile-order-btn" data-direction="down" title="아래로 이동">
                                <i class="fa-solid fa-chevron-down"></i>
                            </button>
                        </div>
                        <button type="button" class="app-info-trigger" aria-expanded="false" aria-label="앱 편집 열기">
                            <span class="mini-preview"></span>
                            <span class="app-row-name"></span>
                            <i class="fa-solid fa-chevron-down app-row-chevron"></i>
                        </button>
                        <input type="checkbox" class="app-vis-check" aria-label="앱 표시" ${isChecked ? 'checked' : ''}>
                    </div>
                    <div class="app-detail-settings" hidden>
                        <label class="app-edit-label">표시할 이름
                            <input type="text" class="app-name-input" maxlength="40" placeholder="기본 이름 사용">
                        </label>
                        <button type="button" class="app-name-reset-btn">이름 초기화</button>
                        <div class="app-icon-editor">
                            <span class="app-edit-label">앱 아이콘</span>
                            <div class="app-icon-preview"></div>
                            <div class="app-icon-actions">
                                <button type="button" class="icon-upload-btn">이미지 선택</button>
                                <button type="button" class="icon-reset-btn">기본 아이콘</button>
                            </div>
                        </div>
                        <div class="sprite-offset-settings">
                            <span>스프라이트 좌표 (행 / 열)</span>
                            <input type="number" class="sprite-row" value="0" aria-label="스프라이트 행">
                            <input type="number" class="sprite-col" value="0" aria-label="스프라이트 열">
                        </div>
                    </div>
                </div>
            `);
            $row.data('app-id', item.id);
            $row.data('icon-class', item.iconClass);
            const displayName = settings.appNames[item.id] || item.label;
            const folder = appFolder(item.id);
            if (folder) $row.find('.app-row-name').attr('title', `${folder.name} 폴더에 있음`);
            $row.find('.app-vis-check').data('id', item.id).prop('checked', isChecked).attr('aria-label', `${displayName} 표시`);
            $row.find('.app-info-trigger').attr('aria-label', `${displayName} 편집`);
            $row.find('.app-row-name').text(displayName);
            $row.find('.app-name-input').val(settings.appNames[item.id] || '').data('original-name', item.label);
            $row.find('.sprite-row').val(offset.r);
            $row.find('.sprite-col').val(offset.c);
            if (expandedId === item.id) {
                $row.find('.app-info-trigger').attr('aria-expanded', 'true');
                $row.find('.app-detail-settings').prop('hidden', false);
            }
            const $previews = expandedId === item.id ? $row.find('.mini-preview, .app-icon-preview') : $row.find('.mini-preview');
            $previews.each(function() {
                if (customIcon) $('<img alt="">').attr('src', customIcon).appendTo(this);
                else $('<i></i>').addClass(item.iconClass).appendTo(this);
            });
            if (folder) $('<button type="button" class="folder-remove-app" aria-label="폴더에서 꺼내기"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>')
                .appendTo($row.find('.main-row')).on('click', () => moveAppToFolder(item.id, null, items));
            appRows.set(item.id, $row);
        });

        const passesFilter = id => appFilter === 'all' || (appFilter === 'visible' ? !settings.hiddenApps.includes(id) : settings.hiddenApps.includes(id));
        const ordered = [...settings.appOrder];
        settings.folders.forEach(folder => { if (!ordered.includes(folderToken(folder.id))) ordered.push(folderToken(folder.id)); });
        ordered.forEach(id => {
            if (folderRows.has(id)) {
                const $folder = folderRows.get(id);
                const folder = settings.folders.find(entry => folderToken(entry.id) === id);
                folder.appIds.forEach(appId => {
                    if (passesFilter(appId) && appRows.has(appId)) $folder.find('.folder-items').append(appRows.get(appId));
                });
                if (!$folder.find('.folder-items').children().length) $('<div class="folder-empty"></div>')
                    .text(appFilter === 'all' ? '앱이 없습니다. 앱을 끌어오거나 아래에서 추가하세요.' : '이 필터에 해당하는 앱이 없습니다.')
                    .appendTo($folder.find('.folder-items'));
                $list.append($folder);
            } else if (appRows.has(id) && !appFolder(id) && passesFilter(id)) {
                $list.append(appRows.get(id));
            }
        });
        $scroller.scrollTop(scrollTop);

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
                if (!e.dataTransfer.types.includes('text/plain')) return;
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
                const fromId = e.dataTransfer.getData('text/plain');
                const toId = $(this).data('app-id');
                if (!fromId || fromId === toId) return;
                const targetFolder = appFolder(toId);
                if (fromId.startsWith('folder:')) {
                    if (!targetFolder) reorderTopLevel(fromId, toId);
                } else if (targetFolder) {
                    if (!items.some(item => item.id === fromId)) return;
                    settings.folders.forEach(folder => { folder.appIds = folder.appIds.filter(id => id !== fromId); });
                    targetFolder.appIds.splice(targetFolder.appIds.indexOf(toId), 0, fromId);
                    saveSettingsDebounced(); renderVisibilitySettings(); requestGridRefresh();
                } else {
                    settings.folders.forEach(folder => { folder.appIds = folder.appIds.filter(id => id !== fromId); });
                    reorderTopLevel(fromId, toId);
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
            requestGridRefresh();
        });

        
        $('#sprite-enable-toggle').on('change', function() {
            customIconData.sprite.enabled = $(this).is(':checked');
            iconStorage.save(customIconData);
            requestGridRefresh();
        });
        
        document.addEventListener('click', e => {
            if (!e.target.closest('#extensionsMenuButton')) return;
            e.preventDefault();
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
        }, true);

        $(document).on('keydown.appMenu', e => {
            if (e.key === 'Escape' && $iphoneContainer.is(':visible') && !settingsPopup) {
                $iphoneContainer.fadeOut(150);
                $globalTooltip.hide();
            }
        });

        
        $(window).on('resize', () => {
            if ($iphoneContainer.is(':visible')) {
                applyCurrentPosition();
            }
        });

        window.addEventListener('storage', event => {
            if (event.key !== iconStorage.key) return;
            customIconData = iconStorage.load();
            requestGridRefresh();
            if (settingsPopup) renderVisibilitySettings();
        });
    }

    $(document).ready(() => {
        init();
        setTimeout(rescanMenu, 500);
        setTimeout(rescanMenu, 1500);
        setTimeout(rescanMenu, 3000);
    });
})();

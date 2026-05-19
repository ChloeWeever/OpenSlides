// i18n.js — UI string translations (EN / ZH)
// window.t(key, ...args)  — returns translated string with {0},{1} interpolation
// window.setLang(lang)    — switches active language

const STRINGS = {
  en: {
    // header (app.js)
    sessions:            'Sessions',
    configureAI:         '⚠ Configure AI settings to get started',
    export:              '↑ Export',
    settings:            '⚙ Settings',
    aiPresentationEditor:'AI Presentation Editor',
    lightMode:           '☀',
    darkMode:            '☾',
    langLabel:           '中',

    // session sidebar
    sessionsSidebar:     'Sessions',
    newPresentation:     '+ New Presentation',
    noSessions:          'No saved sessions yet',
    slides:              'slides',
    justNow:             'just now',
    mAgo:                '{0}m ago',
    hAgo:                '{0}h ago',
    untitled:            'Untitled',
    deleteSession:       'Delete session',
    deleteConfirm:       'Delete',
    cancel:              'Cancel',

    // settings modal
    aiSettings:          'AI Settings',
    configureProvider:   'Configure your LLM provider',
    provider:            'Provider',
    apiKey:              'API Key',
    baseUrl:             'Base URL',
    model:               'Model',
    saveSettings:        'Save Settings',

    // export modal
    exportPresentation:  'Export Presentation',
    exportHtmlDesc:      'Self-contained file, works in any browser',
    exportPdfDesc:       '16:9 pages, print-ready, 1920×1080 px',
    exporting:           '…',
    close:               'Close',
    savedTo:             '✓ Saved to: {0}',
    exportError:         '✕ Error: {0}',

    // chat panel
    aiAssistant:         'AI Assistant',
    noModelSet:          'No model set',
    newSession:          'New session',
    chatPlaceholder:     'Describe your presentation, or ask for changes… (Enter to send)',
    sendHelp:            '⏎ send · ⇧⏎ newline',
    send:                'Send',
    generating:          'Generating',
    selected:            'Selected:',
    quickPrompt1:        'Create a 5-slide intro presentation',
    quickPrompt2:        'Add a summary slide',
    quickPrompt3:        'Make the design more colorful',
    quickPrompt4:        'Add a two-column comparison slide',
    quickPrompt5:        'Suggest improvements',
    genMode:             'Mode:',
    genMode_template:    'Template',
    genMode_solo:        'Solo',
    soloSlide:           'Solo slide (free HTML)',
    genModeTemplateDesc: 'AI fills structured slide templates (layouts, element blocks). Fast and consistent.',
    genModeSoloDesc:     'AI designs each slide as free-form HTML/CSS with full visual freedom. More creative, slower.',
    genComplete:         'Generation complete',
    genSlide:            'Generating slide {0} / {1}',
    genOutlineConfirmed: 'Outline confirmed, {0} slides:',
    genStarting:         'Starting slide-by-slide generation…',
    genSlideFailed:      'Slide {0} failed',
    genFailed:           'Generation failed, please retry',
    genDoneWithErrors:   '✓ {0} slides generated, {1} failed',
    genDoneAll:          '✓ All {0} slides generated!',

    // preview panel toolbar
    prevSlide:           'Previous slide',
    nextSlide:           'Next slide',
    insertImage:         'Insert image(s) into current slide',
    image:               '🖼 Image',
    colorTheme:          'Color theme',
    theme:               'Theme',
    editSlide:           '✎ Edit',
    present:             '▶ Present',
    save:                'Save presentation',
    undo:                'Undo (Ctrl+Z)',
    redo:                'Redo (Ctrl+Y)',
    chooseLayout:        'Choose a layout',
    newSlideAfter:       'New slide after',
    duplicate:           'Duplicate',
    delete:              'Delete',
    newSlide:            'New slide',
    exitPresent:         'Exit (Esc)',

    // brand logo modal
    brandLogo:           '🖼 Brand Logo',
    brandLogoDesc:       'Add a logo overlay to every template slide',
    logoImage:           'Logo Image',
    uploadLogo:          'Upload Image',
    removeLogo:          'Remove Logo',
    logoPosition:        'Position',
    topleft:             'Top Left',
    topright:            'Top Right',
    bottomleft:          'Bottom Left',
    bottomright:         'Bottom Right',
    logoWidth:           'Width',
    logoOpacity:         'Opacity',
    logoEnabled:         'Show Logo',

    // slide editor panel
    editSlidePanelTitle: 'Edit Slide',
    apply:               'Apply',
    layout:              'Layout',
    background:          'Background',
    elements:            'Elements',
    addElement:          'Add element',
  },

  zh: {
    // header
    sessions:            '演示文稿',
    configureAI:         '⚠ 请先配置 AI 设置',
    export:              '↑ 导出',
    settings:            '⚙ 设置',
    aiPresentationEditor:'AI 演示文稿编辑器',
    lightMode:           '☀',
    darkMode:            '☾',
    langLabel:           'EN',

    // session sidebar
    sessionsSidebar:     '演示文稿',
    newPresentation:     '+ 新建演示文稿',
    noSessions:          '暂无已保存的演示文稿',
    slides:              '张幻灯片',
    justNow:             '刚刚',
    mAgo:                '{0}分钟前',
    hAgo:                '{0}小时前',
    untitled:            '未命名',
    deleteSession:       '删除演示文稿',
    deleteConfirm:       '删除',
    cancel:              '取消',

    // settings modal
    aiSettings:          'AI 设置',
    configureProvider:   '配置你的 LLM 提供商',
    provider:            '提供商',
    apiKey:              'API 密钥',
    baseUrl:             '基础 URL',
    model:               '模型',
    saveSettings:        '保存设置',

    // export modal
    exportPresentation:  '导出演示文稿',
    exportHtmlDesc:      '自包含文件，可在任意浏览器中打开',
    exportPdfDesc:       '16:9 页面，适合打印，1920×1080 px',
    exporting:           '…',
    close:               '关闭',
    savedTo:             '✓ 已保存至：{0}',
    exportError:         '✕ 错误：{0}',

    // chat panel
    aiAssistant:         'AI 助手',
    noModelSet:          '未设置模型',
    newSession:          '新建演示文稿',
    chatPlaceholder:     '描述你的演示文稿，或对当前幻灯片提出修改… (Enter 发送)',
    sendHelp:            '⏎ 发送 · ⇧⏎ 换行',
    send:                '发送',
    generating:          '生成中',
    selected:            '已选中：',
    quickPrompt1:        '创建一个5页的介绍演示文稿',
    quickPrompt2:        '添加一个总结页',
    quickPrompt3:        '让设计更丰富多彩',
    quickPrompt4:        '添加一个双栏对比页',
    quickPrompt5:        '提出改进建议',
    genMode:             '模式：',
    genMode_template:    '模板',
    genMode_solo:        'Solo',
    soloSlide:           'Solo 幻灯片（自由 HTML）',
    genModeTemplateDesc: 'AI 填充结构化幻灯片模板（布局、元素块），速度快、风格一致。',
    genModeSoloDesc:     'AI 将每张幻灯片设计为自由 HTML/CSS，视觉自由度更高，速度较慢。',
    genComplete:         '生成完成',
    genSlide:            '正在生成幻灯片 {0} / {1}',
    genOutlineConfirmed: '大纲已确认，共 {0} 页：',
    genStarting:         '开始逐页生成…',
    genSlideFailed:      '幻灯片 {0} 生成失败',
    genFailed:           '生成失败，请重试',
    genDoneWithErrors:   '✓ {0} 页已生成，其中 {1} 页生成失败',
    genDoneAll:          '✓ 全部 {0} 页幻灯片已生成完成！',

    // preview panel toolbar
    prevSlide:           '上一张',
    nextSlide:           '下一张',
    insertImage:         '插入图片到当前幻灯片',
    image:               '🖼 图片',
    colorTheme:          '颜色主题',
    theme:               '主题',
    editSlide:           '✎ 编辑',
    present:             '▶ 演示',
    save:                '保存',
    undo:                '撤销 (Ctrl+Z)',
    redo:                '重做 (Ctrl+Y)',
    chooseLayout:        '选择布局',
    newSlideAfter:       '在后方新建幻灯片',
    duplicate:           '复制',
    delete:              '删除',
    newSlide:            '新建幻灯片',
    exitPresent:         '退出 (Esc)',

    // brand logo modal
    brandLogo:           '🖼 品牌 Logo',
    brandLogoDesc:       '为每张模板幻灯片添加 Logo 水印',
    logoImage:           'Logo 图片',
    uploadLogo:          '上传图片',
    removeLogo:          '删除 Logo',
    logoPosition:        '位置',
    topleft:             '左上',
    topright:            '右上',
    bottomleft:          '左下',
    bottomright:         '右下',
    logoWidth:           '宽度',
    logoOpacity:         '透明度',
    logoEnabled:         '显示 Logo',

    // slide editor panel
    editSlidePanelTitle: '编辑幻灯片',
    apply:               '应用',
    layout:              '布局',
    background:          '背景色',
    elements:            '元素',
    addElement:          '添加元素',
  },
};

window._lang = localStorage.getItem('openslides-lang') || 'en';

window.t = function(key) {
  var args = Array.prototype.slice.call(arguments, 1);
  var s = (STRINGS[window._lang] || STRINGS.en)[key] || key;
  args.forEach(function(a, i) { s = s.replace('{' + i + '}', a); });
  return s;
};

window.setLang = function(lang) {
  window._lang = lang;
  localStorage.setItem('openslides-lang', lang);
};

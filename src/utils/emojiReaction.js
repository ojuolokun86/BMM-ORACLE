const { cancelKickAll } = require("../message-controller/kickAll");

const commandEmojis = {
    // General Commands
    menu: '📜',
    info: 'ℹ️',
    ping: '🏓',
    about: '📖',
    restart: '🔄',

    // Customization Commands
    prefix: '🔤',
    tagformat: '🎨',

    // Group Commands
    tagall: '📢',
    setmode: '⚙️',
    antidelete: '🛡️',
    warn: '⚠️',
    resetwarn: '♻️',
    listwarn: '📋',
    warncount: '🔢',
    welcome: '👋',
    setwelcome: '✍️',
    group: '🏢',
    poll: '📊',
    endpoll: '🛑',
    kick: '🚪',
    add: '➕',
    promote: '⬆️',
    demote: '⬇️',
    clear: '🧹',
    mute: '🔒',
    unmute: '🔓',
    kickall: '🚪',
    announce: '📢',
    leave: '🚪',
    logout: '🤖',
    formatrespond: '🗣️',
    dnd: '📞',
    upload: '📤',
    stats: '📈',
    active: '🟢',
    inactive: '🔴',
    yeskick: '✅',
    cancelkick: '❌',
    yesdestroy: '✅',
    canceldestroy: '❌',
    time: '⏰',
    confirm: '✔️',
    cancelk: '❌',
    download: '⬇️',
    listgroups: '📋',
    help: '📜',

    // Utility Commands
    delete: '🗑️',
    fun: '🎉',
    view: '👁️',
    status: '👀',
    setname: '✏️',
    setpic: '🖼️',
    setstatus: '✏️',
    presence: '🔄',
    seen: '👁️',
    bug: '🪲',
    protect: '🛡️',
    deleteit: '🗑️',
    block: '🚫',
    unblock: '✅',
    imagine: '🖌️',

    // Protection Commands
    antilink: '🔗',

    // Community & Group Commands
    create: '🏢',
    destroy: '❌',
    admin: '📢',

    // Fun Commands (expanded)
    sticker: '🖼️',
    emoji: '😎',
    fight: '🥊',
    kill: '💀',
    cry: '😭',
    angry: '😡',
    humble: '🙏',
    laugh: '😂',
    dance: '💃',
    love: '❤️',
    slap: '🤚',
    hug: '🤗',
    pat: '🫶',
    kiss: '😘',
    poke: '👊',
    cuddle: '🥰',
    wave: '👋',
    kickfun: '🦶',
    bite: '🦷',
    tickle: '🫳',
    feed: '🤲',
    highfive: '🤝',
    facepalm: '🤦',
    blush: '😳',
    bored: '😐',
    smug: '😏',
    pout: '😶',
    smile: '😃',
    stare: '👀',
    think: '🤔',
    shrug: '🤷',
    thumbsup: '👍',
    yeet: '🥏',
    shoot: '🔫',
    baka: '😂',

    // Mini-games & fun
    flip: '🪙',
    roll: '🎲',
    quote: '💬',
    joke: '😂',
    ai : '🤖',
};

const getEmojiForCommand = (command) => {
    const randomEmojis = ['👍', '🎉', '✨', '🔥', '✅', '💡', '🎯'];
    return commandEmojis[command] || randomEmojis[Math.floor(Math.random() * randomEmojis.length)];
};

module.exports = { getEmojiForCommand };
const ansiregex = /\0|[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
let added = [];

const {stripVTControlCharacters:stripVTCC} = require('node:util');

const Key = {
    // bindings for ctrl+KEY
    ctrl: {
                   a: '\x01', b: '\x02', c: '\x03', 
        d: '\x04', 
                              
        l: '\x0c',            n: '\x0e', o: '\x0f', 
                              r: '\x12', s: '\x13', 
        t: '\x14', u: '\x15', v: '\x16', w: '\x17', 
        x: '\x18', y: '\x19', z: '\x1a',

        '@':  '\x00', '`': '\x00', '[': '\x1b', '{': '\x1b', 
        '\\': '\x1c', '|': '\x1c', ']': '\x1d', '}': '\x1d',
        '^':  '\x1e', '~': '\x1e', '_': '\x1f', '?': '\x7f',

        'up': '\x1b[1;5A',    'down': '\x1b[1;5B',
        'right': '\x1b[1;5C', 'left': '\x1b[1;5D',

        'home': '\x1b[1;5~',   'end': '\x1b[4;5~',
        'pageup': '\x1b[5;5~', 'pagedown': '\x1b[6;5~',
        'insert': '\x1b[2;5~', 'delete': '\x1b[3;5~',
    },

    // bindings for shift+KEY
    shift: {
        'up': '\x1b[1;2A',    'down': '\x1b[1;2B',
        'right': '\x1b[1;2C', 'left': '\x1b[1;2D',

        'home':   '\x1b[1;2~', 'end':      '\x1b[4;2~',
        'pageup': '\x1b[5;2~', 'pagedown': '\x1b[6;2~',
        'insert': '\x1b[2;2~', 'delete':   '\x1b[3;2~',
    },

    // bindings for ctrl+shift+KEY
    ctrl_shift: {
        'up':    '\x1b[1;6A', 'down': '\x1b[1;6B',
        'right': '\x1b[1;6C', 'left': '\x1b[1;6D',

        'home':   '\x1b[1;6~', 'end':      '\x1b[4;6~',
        'pageup': '\x1b[5;6~', 'pagedown': '\x1b[6;6~',
        'insert': '\x1b[2;6~', 'delete':   '\x1b[3;6~',
    },

    a: 'a', b: 'b', c: 'c', d: 'd', e: 'e',
    f: 'f', g: 'g', h: 'h', i: 'i', j: 'j',
    k: 'k', l: 'l', m: 'm', n: 'n', o: 'o',
    p: 'p', q: 'q', r: 'r', s: 's', t: 't',
    u: 'u', v: 'v', w: 'w', x: 'x', y: 'y',
    z: 'z',

    A: 'A', B: 'B', C: 'C', D: 'D', E: 'E',
    F: 'F', G: 'G', H: 'H', I: 'I', J: 'J',
    K: 'K', L: 'L', M: 'M', N: 'N', O: 'O',
    P: 'P', Q: 'Q', R: 'R', S: 'S', T: 'T',
    U: 'U', V: 'V', W: 'W', X: 'X', Y: 'Y',
    Z: 'Z',

    // Ctrl+S
    save: '\x13',
    // Ctrl+V
    paste: '\x16',
    // Ctrl+X
    cut: '\x18',
    // Ctrl+C
    copy: '\x03',

    backspace: '\x08',
    delete: '\x1b[3~', del: '\x1b[3~',
    up: '\x1b[A', down: '\x1b[B', left: '\x1b[D', right: '\x1b[C',
    home: '\x1b[1~', end: '\x1b[4~',
    enter: '\r', escape: '\x1b',
}

const cancelChars = '\x03\x04\x1B';
const CancelChar =  Symbol('CANCEL');

const mod = (a,b) => (b+(a%b))%b;

function getch(raw=false,encoding='utf-8',CtrlC=()=>{process.stdout.write('\x1b[m');process.exit()},CtrlD=CtrlC,stdin=process.stdin) {
    return new Promise(
        r => {
            let rawmode;
            if (stdin.setRawMode) rawmode = stdin.setRawMode(true);
            if (stdin.ref) stdin.ref();
            stdin.once( 'data', (d) => {
                if (!raw) {
                         if (d == '\x1b[D') r('left');
                    else if (d == '\x1b[C') r('right');
                    else if (d == '\x1b[A') r('up');
                    else if (d == '\x1b[B') r('down');
                    else if (d == '\x1b[1~') r('home');
                    else if (d == '\x1b[2~') r('insert');
                    else if (d == '\x1b[3~') r('delete');
                    else if (d == '\x1b[4~') r('end');
                    else if (d == '\x1b[5~') r('page up');
                    else if (d == '\x1b[6~') r('page down');
                    else if (d == '\x1b') r('esc');
                    else if (d == '\x08') r('backspace');
                    else if (d == '\x03' && CtrlC) CtrlC();
                    else if (d == '\x04' && CtrlD) CtrlD();
                    else r(encoding?d.toString(encoding):d);
                } else {
                         if (d == '\x03' && CtrlC) r(CtrlC());
                    else if (d == '\x04' && CtrlD) CtrlD();
                    else r(encoding?d.toString(encoding):d);
                }
                if (stdin.setRawMode) stdin.setRawMode(rawmode);
                if (stdin.unref && stdin.ref) stdin.unref();
            });
        }
    );
}

/*function input(prompt,encoding='utf-8') {
    if (prompt) process.stdout.write(prompt)
    let d = Buffer.alloc(1024);
    process.stdin.setRawMode(false);
    process.stdin.read();
    process.stdin.resume();
    return new Promise(
        r => {
            fs.read(0,d,0,d.length,null,(e,length)=>{
                d = d.subarray(0,length-2);
                r(encoding?d.toString(encoding):d);
            });
        }
    );
}*/

/*async function input(prompt,settings) {
    let st = {
        'onAbort': ()=>{st.stdout.write(`\x1b[G\x1b[m${prompt}${value}${!value.length&&settings.emptyPlaceholder.length?' '.repeat(settings.emptyPlaceholder.length):''}\x1b[m`);if(st.doExit)process.exit()},
        'doExit': true,
        'default': '',
        'emptyPlaceholder': '',
        replace: null,
        stdin: process.stdin,
        stdout: process.stdout
    };
    
    let rprompt = prompt;
    prompt = prompt.replace(ansiregex,'');
    Object.assign(st,settings);

    settings = st;
    settings.default = typeof settings.default.toString == 'function'?settings.default.toString():toString(settings.default);

    let value = settings.default;
    let cur = settings.default.length;
    let e = false;

    const {stdin,stdout} = settings;

    stdout.write(
        rprompt +
        settings.default +
        (
            !settings.default.length&&settings.emptyPlaceholder.length?
             (e=true,settings.emptyPlaceholder+`\x1b[${settings.emptyPlaceholder.replace(ansiregex,'').length}D`) :
             ''
        )
    );
    while (true) {
        let chr = await getch(true,null,settings.onAbort,settings.onAbort,stdin);
        if (chr == undefined) return chr;
        if (chr == Key.backspace) {
            let l1 = value.length;
            value = value.slice(0,cur-1) + value.slice(cur);
            let diff = l1 - value.length;
            stdout.write((cur?`\x1b[${cur}D`:``)+(settings.replace?settings.replace.repeat(value.length):value)+' '+(value.length-(cur-diff)+1?`\x1b[${value.length-(cur-diff)+1}D`:``));
            cur -= diff;
            if (cur == 0 && value.length == 0 && settings.emptyPlaceholder.length) stdout.write((e=true,`${settings.emptyPlaceholder}`+`\x1b[${settings.emptyPlaceholder.replace(ansiregex,'').length}D`));
        } else
        if (chr == Key.delete) {
            value = value.slice(0,cur) + value.slice(cur+1);
            stdout.write((cur?`\x1b[${cur}D`:``)+(settings.replace?settings.replace.repeat(value.length):value)+' '+(value.length-cur+1?`\x1b[${value.length-cur+1}D`:``));
            if (cur == 0 && value.length == 0 && settings.emptyPlaceholder.length) stdout.write((e=true,`${settings.emptyPlaceholder}`+`\x1b[${settings.emptyPlaceholder.replace(ansiregex,'').length}D`));
        } else
        if (chr == '\r') {
            console.log();
            return value;
        } else
        if (chr == Key.left) {
            let diff = cur - Math.max(0,cur-1);
            cur -= diff;
            if (diff>0) stdout.write(`\x1b[${diff}D`);
        } else
        if (chr == Key.right) {
            let diff =  Math.min(value.length,cur+1) - cur;
            cur += diff;
            if (diff>0) stdout.write(`\x1b[${diff}C`);
        } else 
        if (chr == Key.home) {
            stdout.write(`\x1b[${cur}D`);
            cur = 0;
        } else
        if (chr == Key.end) {
            stdout.write(`\x1b[${value.length-cur}C`);
            cur = value.length-1;
        } else if (chr.length && !Object.values(Key.ctrl).includes(chr) && chr.indexOf('\x1b')==-1) {
            chr = chr.toString('utf-8');
            added.push(chr);
            value = value.slice(0,cur) + chr + value.slice(cur);
            if (e) stdout.write(` `.repeat(settings.emptyPlaceholder.replace(ansiregex,'').length)+`\x1b[${settings.emptyPlaceholder.replace(ansiregex,'').length}D`);
            stdout.write((cur?`\x1b[${cur}D`:``)+(settings.replace?settings.replace.repeat(value.length):value)+(value.length-(cur+1+chr.length)?`\x1b[${value.length-(cur+1+chr.length)}D`:``));
            cur += chr.length;
        }
    }
}*/

/**
 * (Taken from another project)
 * @param {string} prompt the prompt to show before the text
 * @param {number?} x the X position of the text
 * @param {number?} y the Y position of the text
 * @param {((string)=>string)?} replace a function that gets called with the current text and that should return what to display instead
 * @param {string?} defaultValue the defalt value 
 * @param {string?} placeHolder text to display when nothing is written
 * @param {((string)=>void)?} update a function called whenever the value is modified
 */
async function input(prompt,x,y,replace,defaultValue,placeHolder='',exitChars=cancelChars,update=()=>undefined) {
    /**
     * Returns the current position of the cursor
     */
    async function DSR() {
        process.stdout.write(`\x1b[6n`);
        return Array.from((await getch('utf-8')).match(/\x1b\[(\d*);(\d*)R/)).slice(1).map(n=>+(n|'0'));
    }
    const getch = function(encoding='utf-8',CtrlC=()=>{process.stdout.write('\x1b[m');process.exit()},CtrlD=CtrlC,stdin=process.stdin) {
        return new Promise(
            r => {
    
                let rawmode;
    
                if (stdin.setRawMode) rawmode = stdin.setRawMode(true);
                if (stdin.ref)        stdin.ref();
    
                stdin.once( 'data', (d) => {
    
                    if (d == '\x03' && CtrlC) 
                        r(CtrlC());
                    else if (d == '\x04' && CtrlD) 
                        r(CtrlD());
                    else 
                        r(encoding?d.toString(encoding):d);
    
                    if (stdin.setRawMode)         stdin.setRawMode(rawmode);
                    if (stdin.unref && stdin.ref) stdin.unref();
    
                });
    
            }
        );
    }
    let val = defaultValue || '', // the text being written
        cur = (defaultValue || '').length; // the cursor position
    {
        let prePrompt = (typeof x == 'number' && typeof x == typeof y) ? `\x1b[${y};${x}H` : ``;
        let value = typeof replace == 'function' ? replace(val) : val;
        process.stdout.write(prePrompt  + (typeof prompt == 'function' ? prompt(value) : prompt) + value);
    }
    while (true) {
        let ch = await getch('utf-8',()=>Key.ctrl.c,()=>Key.ctrl.d);
        let oc = cur;
        if (ch == '\r' || exitChars.includes(ch)) {
        } else if (ch == Key.backspace) {
            val = val.slice(0,cur-1) + val.slice(cur);
            cur = Math.max(0, cur-1);
        } else if (ch == Key.left) {
            cur = Math.max(0, cur-1);
        } else if (ch == Key.right) {
            cur = Math.min(val.length, cur+1);
        } else if (ch == Key.home) {
            cur = 0;
        } else if (ch == Key.end) {
            cur = val.length;
        } else if (ch == Key.delete) {
            val = val.slice(0,cur) + val.slice(cur+1);
        } else if (Object.values(Key.shift).concat(Object.values(Key.ctrl),Object.values(Key.ctrl_shift)).includes(ch)) {
        } else {
            let v = stripVTCC(ch);
            val = val.slice(0,cur) + v + val.slice(cur);
            cur += v.length;
        }
        let prePrompt = (typeof x == 'number' && typeof x == typeof y) ? `\x1b[${y};${x}H` : `${(oc+(typeof prompt == 'function' ? prompt(val) : prompt).length)?`\x1b[${oc+(typeof prompt == 'function' ? prompt(val) : prompt).length}D`:''}`;
        let value  = ( typeof replace == 'function' ? await replace(val) : val );
            value += ( !val.length ? placeHolder||'' : value.length-stripVTCC(placeHolder).length>0 ? ' '.repeat(value.length-stripVTCC(placeHolder).length) : '' );
        let resetPos = `\x1b[${(await DSR()).join(';')}H`;
        await update(val,ch);
        process.stdout.write(resetPos + prePrompt + (typeof prompt == 'function' ? await prompt(val) : prompt) + value + ((ch == '\b' || ch == '\x1b[3~')?' ':'') + ((ch != '\r') ? `\x1b[${(stripVTCC(value).length-cur+(ch == '\b' || ch == '\x1b[3~'))?`\x1b[${stripVTCC(value).length-cur+(ch == '\b' || ch == '\x1b[3~')}D`:''}` : ''));
        if (ch == '\r') {
            process.stdout.write('\n');
            return val;
        }
        if (exitChars.includes(ch)) {
            return CancelChar;
        }
    }
}

async function choice(prompt,settings={}) {
    if (Array.isArray(settings)) settings = {values:settings};
    settings = Object.assign({
        values:  [ ],
        rv: null,
        cursor:  '> ',
        _cursor: '  ',
        indent:  1,
        
        ln: true,
        clear: false,
        onAbort: 
            ()=>{
                settings.stdout.write(`\x1b[2K\x1b[B`.repeat(settings.values.length+1) + `\x1b[A`.repeat(settings.values.length+1) + `\x1b[G\x1b[m`);
                if(settings.doExit)process.exit();
            },
        doExit: true,

        stdin: process.stdin,
        stdout: process.stdout
    },settings);

    const {stdout,stdin} = settings;

    function update(nr=false) {
        //stdout.write(`${prompt}\x1b[7${settings.values.map((v,p)=>' '.repeat(settings.indent)+(p==i?settings.cusor:settings._cussor)+v).join('\n')}\x1b[8`);
        stdout.write(`\x1b[G${prompt}                       \n${settings.values.map((v,p)=>'\x1b[K'+' '.repeat(settings.indent)+(p==i?settings.cursor:settings._cursor)+v).join('\n')}`+(nr?'\n':`\x1b[${prompt.replace(ansiregex,'').length+1}G\x1b[${settings.values.length}A`));
    }

    let i = 0; 

    stdout.write('\n'.repeat(settings.values.length+1)+'\x1b[A'.repeat(settings.values.length+1)+'\x1b[G')

    while (true) {
        update();
        let chr = await getch(true,null,settings.onAbort,undefined,stdin);
        if (chr == Key.up) 
            i = mod(i-1,settings.values.length);
        if (chr == Key.down) 
            i = mod(i+1,settings.values.length);
        if (chr == Key.enter) {
            update(settings.ln);
            if (settings.clear) {
                stdout.write(`\x1b[2K\x1b[B`.repeat(settings.values.length+1) + `\x1b[A`.repeat(settings.values.length+1) + `\x1b[G`);
            }
            return settings.rv?settings.rv[i]:settings.values[i];
        }
    }
}

module.exports = {getch,input,choice,Key,added,CancelChar};
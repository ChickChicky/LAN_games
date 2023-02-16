const ansiregex = /\0|[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
let added = [];

const Key = {
    // bindings for ctrl+KEY
    ctrl: {
                   a: '\x01', b: '\x02', c: '\x03', 
        d: '\x04', 
                              
        l: '\x0c',            n: '\x0e', o: '\x0f', 
                              r: '\x12', s: '\x13', 
        t: '\x14', u: '\x15', v: '\x16', w: '\x17', 
        x: '\x18', y: '\x19', z: '\x1a',
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
    enter: '\r'
}

const mod = (a,b) => (b+(a%b))%b;

function getch(raw=false,encoding='utf-8',CtrlC=()=>{process.stdout.write('\x1b[m');process.exit()},CtrlD=CtrlC) {
    return new Promise(
        r => {
            process.stdin.setRawMode(true);
            process.stdin.ref();
            process.stdin.once( 'data', (d) => {
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
                process.stdin.setRawMode(false);
                process.stdin.unref();
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

async function input(prompt,settings) {
    let st = {
        'onAbort': ()=>{process.stdout.write(`\x1b[G\x1b[m${prompt}${value}${!value.length&&settings.emptyPlaceholder.length?' '.repeat(settings.emptyPlaceholder.length):''}\x1b[m`);process.exit()},
        'default': '',
        'emptyPlaceholder': '',
        replace: null,
    };
    let rprompt = prompt;
    prompt = prompt.replace(ansiregex,'');
    Object.assign(st,settings);
    settings = st;
    settings.default = typeof settings.default.toString == 'function'?settings.default.toString():toString(settings.default);
    let value = settings.default;
    let cur = settings.default.length;
    let e = false;
    process.stdout.write(
        rprompt +
        settings.default +
        (
            !settings.default.length&&settings.emptyPlaceholder.length?
             (e=true,settings.emptyPlaceholder+`\x1b[${settings.emptyPlaceholder.replace(ansiregex,'').length}D`) :
             ''
        )
    );
    while (true) {
        let chr = await getch(true,null,settings.onAbort);
        if (chr == undefined) return chr;
        if (chr == Key.backspace) {
            let l1 = value.length;
            value = value.slice(0,cur-1) + value.slice(cur);
            let diff = l1 - value.length;
            process.stdout.write((cur?`\x1b[${cur}D`:``)+(settings.replace?settings.replace.repeat(value.length):value)+' '+(value.length-(cur-diff)+1?`\x1b[${value.length-(cur-diff)+1}D`:``));
            cur -= diff;
            if (cur == 0 && value.length == 0 && settings.emptyPlaceholder.length) process.stdout.write((e=true,`${settings.emptyPlaceholder}`+`\x1b[${settings.emptyPlaceholder.replace(ansiregex,'').length}D`));
        } else
        if (chr == Key.delete) {
            value = value.slice(0,cur) + value.slice(cur+1);
            process.stdout.write((cur?`\x1b[${cur}D`:``)+(settings.replace?settings.replace.repeat(value.length):value)+' '+(value.length-cur+1?`\x1b[${value.length-cur+1}D`:``));
            if (cur == 0 && value.length == 0 && settings.emptyPlaceholder.length) process.stdout.write((e=true,`${settings.emptyPlaceholder}`+`\x1b[${settings.emptyPlaceholder.replace(ansiregex,'').length}D`));
        } else
        if (chr == '\r') {
            console.log();
            return value;
        } else
        if (chr == Key.left) {
            let diff = cur - Math.max(0,cur-1);
            cur -= diff;
            if (diff>0) process.stdout.write(`\x1b[${diff}D`);
        } else
        if (chr == Key.right) {
            let diff =  Math.min(value.length,cur+1) - cur;
            cur += diff;
            if (diff>0) process.stdout.write(`\x1b[${diff}C`);
        } else 
        if (chr == Key.home) {
            process.stdout.write(`\x1b[${cur}D`);
            cur = 0;
        } else
        if (chr == Key.end) {
            process.stdout.write(`\x1b[${value.length-cur}C`);
            cur = value.length-1;
        } else if (chr.length && !Object.values(Key.ctrl).includes(chr) && chr.indexOf('\x1b')==-1) {
            chr = chr.toString('utf-8');
            added.push(chr);
            value = value.slice(0,cur) + chr + value.slice(cur);
            if (e) process.stdout.write(` `.repeat(settings.emptyPlaceholder.replace(ansiregex,'').length)+`\x1b[${settings.emptyPlaceholder.replace(ansiregex,'').length}D`);
            process.stdout.write((cur?`\x1b[${cur}D`:``)+(settings.replace?settings.replace.repeat(value.length):value)+(value.length-(cur+1+chr.length)?`\x1b[${value.length-(cur+1+chr.length)}D`:``));
            cur += chr.length;
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
            process.stdout.write(`\x1b[2K\x1b[B`.repeat(settings.values.length+1) + `\x1b[A`.repeat(settings.values.length+1) + `\x1b[G\x1b[m`);
            process.exit();
         },
    },settings);

    function update(nr=false) {
        //process.stdout.write(`${prompt}\x1b[7${settings.values.map((v,p)=>' '.repeat(settings.indent)+(p==i?settings.cusor:settings._cussor)+v).join('\n')}\x1b[8`);
        process.stdout.write(`\x1b[G${prompt}                       \n${settings.values.map((v,p)=>'\x1b[K'+' '.repeat(settings.indent)+(p==i?settings.cursor:settings._cursor)+v).join('\n')}`+(nr?'\n':`\x1b[${prompt.replace(ansiregex,'').length+1}G\x1b[${settings.values.length}A`));
    }

    let i = 0; 

    process.stdout.write('\n'.repeat(settings.values.length+1)+'\x1b[A'.repeat(settings.values.length+1)+'\x1b[G')

    while (true) {
        update();
        let chr = await getch(true,null,settings.onAbort);
        if (chr == Key.up) 
            i = mod(i-1,settings.values.length);
        if (chr == Key.down) 
            i = mod(i+1,settings.values.length);
        if (chr == Key.enter) {
            update(settings.ln);
            if (settings.clear) {
                process.stdout.write(`\x1b[2K\x1b[B`.repeat(settings.values.length+1) + `\x1b[A`.repeat(settings.values.length+1) + `\x1b[G`);
            }
            return settings.rv?settings.rv[i]:settings.values[i];
        }
    }
}

module.exports = {getch,input,choice,Key,added};
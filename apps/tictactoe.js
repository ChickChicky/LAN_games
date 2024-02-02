const appNetwork = require('../appNetwork');

function runServer(cb) {
    let board = [0,0,0,0,0,0,0,0,0];
    let player = 0;

    let winMask = [
        [ 1,1,1,0,0,0,0,0,0 ],
        [ 0,0,0,1,1,1,0,0,0 ],
        [ 0,0,0,0,0,0,1,1,1 ],
        [ 1,0,0,1,0,0,1,0,0 ],
        [ 0,1,0,0,1,0,0,1,0 ],
        [ 0,0,1,0,0,1,0,0,1 ],
        [ 1,0,0,0,1,0,0,0,1 ],
        [ 0,0,1,0,1,0,1,0,0 ],
    ];

    function getWinner() {
        if (winMask.some(m=>board.every((c,i)=>c==1||!m[i]))) return 0;
        if (winMask.some(m=>board.every((c,i)=>c==2||!m[i]))) return 1;
    }

    const server = new appNetwork.Server(cb)
        .onConnection(
            s => {
                if (server.clients.length > 2) {
                    return 'Room full';
                } else {
                    console.log(`Client connected ${s.remoteAddress} ${s.remotePort}`);
                }
            }
        )
        .addRequest(
            'place', true,
            (d,s) => {
                let p = server.clients.indexOf(s);
                if (p == player && board[d] == 0) {
                    board[d] = player + 1;
                    player = ( player + 1 ) % 2
                }
                server.dispatchEvent('sync',{board,w:getWinner()??(board.every(c=>c!=0)?2:undefined),player});
            }
        );

    setInterval(
        () => {
            server.dispatchEvent('sync',{board,w:getWinner(),player});
        },
        1000
    );

    const sin  = process.stdin;
    const getch = () => new Promise(r=>sin.once('data',r));
    sin.setRawMode(true);
    process.on('exit',()=>{sin.setRawMode(false);});
    ;(async()=>{
        while (true) {
            let k = await getch();
            if (k == '\x03') break;
        }
        process.exit();
    })();
}

function runClient( addr, cb=()=>null ) {
    let board = [0,0,0,0,0,0,0,0,0];
    let winner;
    let player = 0;
    let selected = 4;

    const sout = process.stdout;
    const sin  = process.stdin;

    const getch = s => new Promise(
        r => {
            sin.once('data',r);
            if (s instanceof AbortController) {
                s.signal.addEventListener('abort',
                    () => {
                        console.log('WOOOT');
                        sin.off('data',r);
                        r(null);
                    }
                );
            }
        }
    );
    const mod   = (a,b) => ((a%b)+b)%b;

    let orm = sin.rawMode;
    sin.setRawMode(true);
    process.on('exit',()=>sin.setRawMode(orm));

    function renderCell(i,w) {
        let v = board[i];
        let wm = winMask[getWinMask(w+1)];
        return ((w!=undefined?w==2?false:wm[i]:selected==i)?'\x1b[7m':'') + (['.','\x1b[31mX','\x1b[34mO'][v]??'?') + '\x1b[39;27m';
    }

    function render(w) {
        let ws = ['\x1b[31m','\x1b[34m','\x1b[90m'][w]??'';
        sout.write(
            `\x1b[5A\x1b[G`+
            ` ${renderCell(0,w)} ${ws}|\x1b[39m ${renderCell(1,w)} ${ws}|\x1b[39m ${renderCell(2,w)}` + '\n' +
            `${ws}-----------\x1b[39m\n`+
            ` ${renderCell(3,w)} ${ws}|\x1b[39m ${renderCell(4,w)} ${ws}|\x1b[39m ${renderCell(5,w)}` + '  ' + (w==undefined?['X','O'][player]:' ') + '\n' +
            `${ws}-----------\x1b[39m\n`+
            ` ${renderCell(6,w)} ${ws}|\x1b[39m ${renderCell(7,w)} ${ws}|\x1b[39m ${renderCell(8,w)}` + '\n'
        );
    }

    let winMask = [
        [ 1,1,1,0,0,0,0,0,0 ],
        [ 0,0,0,1,1,1,0,0,0 ],
        [ 0,0,0,0,0,0,1,1,1 ],
        [ 1,0,0,1,0,0,1,0,0 ],
        [ 0,1,0,0,1,0,0,1,0 ],
        [ 0,0,1,0,0,1,0,0,1 ],
        [ 1,0,0,0,1,0,0,0,1 ],
        [ 0,0,1,0,1,0,1,0,0 ],
    ];
    
    function getWinMask(w) {
        return winMask.findIndex(m=>board.every((c,i)=>c==w||!m[i]));
    }

    //\\

    const gameEnds = new AbortController();

    const app = new appNetwork.App(addr)
        .addRequest( 'place', true )
        .addEvent( 'sync', d =>{
            ({board,w:winner,player} = d);
            render(winner);
            if (winner != undefined) {
                console.log(['\x1b[31mPlayer 1','\x1b[34mPlayer 2','\x1b[90mNobody'][winner] + '\x1b[39m won'+(winner==2?'.':' !'));
                process.exit();
            }
        });
    
    cb();

    //\\

    {(async()=>{
        sout.write('\n\n\n\n\n');
        
        while (true) {
            render(winner);
            let k = await getch();
            if (k == '\x1b[A') selected = mod(selected-3,9);
            if (k == '\x1b[B') selected = mod(selected+3,9);
            if (k == '\x1b[C') selected = mod(selected+1,9);
            if (k == '\x1b[D') selected = mod(selected-1,9);
            if (k == '\r' && board[selected]==0) {
                app.sendRequest('place',selected);
            }
            if (k == '\x03') break;
        }
    
        process.exit();
    })()}

}

module.exports = { runClient, runServer };
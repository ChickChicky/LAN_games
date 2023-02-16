const appNetwork = require('../appNetwork');



function runServer(cb) {

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
        .onDisconnect(
            s => {

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
    )
}

function runClient( addr, cb=()=>null ) {

    const sout = process.stdout;
    const sin  = process.stdin;

    const getch = s => new Promise(r=>sin.once('data',r));

    const mod  = (a,b) => ((a%b)+b)%b;

    let orm = sin.rawMode;
    sin.setRawMode(true);
    process.on('exit',()=>sin.setRawMode(orm));

    function render() {

    }

    //\\

    const app = new appNetwork.App(addr)
        .addRequest( 'move' )
        .addRequest( 'drop' )
        .addRequest( 'use' )
        .addEvent( 'sync', d =>{
            
        });
    
    cb();

    //\\

    {(async()=>{
        
        while (true) {
            render(winner);
            let k = await getch();
            if (k == '\x1b[A') selected = mod(selected-3,9);
            if (k == '\x1b[B') selected = mod(selected+3,9);
            if (k == '\x1b[C') selected = mod(selected+1,9);
            if (k == '\x1b[D') 
            if (k == '\r' && board[selected]==0) {
                app.sendRequest('place',selected);
            }
            if (k == '\x03') break;
        }
    
        process.exit();
    })()}

}

module.exports = { runClient, runServer };
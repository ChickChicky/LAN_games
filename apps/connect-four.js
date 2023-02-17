const appNetwork = require('../appNetwork');

/**@type {[[number,number],[number,number],number][]}*/
let winningPatterns = [
    [ [0,6],[0,3],1 ],
    [ [0,2],[0,7],7 ],
    [ [0,2],[0,3],8 ],
    [ [0,2],[3,7],6 ],
];

/**
 * Returns where a token would land if it was dropped at the currently pointed poition.
 * @returns {number|null}
 */
 function getDropPos(selected,board) {
    let r = 5;
    while (r >= 0) {
        let i = r*7+selected;
        if (board[i] == 0) {
            return i;
        }
        r--;
    }
    return null;
}

/**
 * Returns the ID of the player who has won and the indexes of the tokens who made him win
 * (or null if nobody is winning)
 * @returns {[number,number]|[null,null]}
 */
 function getWinningInfo(board) {
    /*
    To check whethr a player has won, eachpattern is used as a mask on the board to check whether all of the undelying tokens
        are owned by either player.
    Each patterns specifies 3 values: a row range, a column range, a row range and an increment.
    The tokens are stores in a single array and it is "wrapped" when rendered to make it look like an actual grid for connect-four.
    This means that obtaining a sequence of any amount of cells that are in line is very easy, an increment of 1 checks for all the cells
        horizontally, an increment equal to the width of the grid checks for vertical alignments, an increment equal to the width plus one
        would check for cells in a diagonal from top-left to bottom-right and finally, an increment equal to the width minus one, the opposite
        diagonal.
    That is what the increment is, and the two other values silply specify the range in terms of columns and rows to apply the mask in so that
        it doesn't overflow oer other weird stuff happens.
    */
    for (let pi in winningPatterns) { pi=+pi;
        let p = winningPatterns[pi];
        for (let r = p[0][0]; r < p[0][1]+1; r++)
        for (let c = p[1][0]; c < p[1][1]+1; c++) {
            let i = Array.from(Array(4),(_,j)=>r*7+c+j*p[2]);
            if (i.every(j=>board[j]==1)) return [0,i];
            if (i.every(j=>board[j]==2)) return [1,i];
        } 
    }
    return [null,null];
}

function runServer(cb) {

    let player = 0;
    let board = Array(42).fill(0);

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
            'dropToken', true,
            (d,s) => {
                let p = server.clients.indexOf(s);
                let dp = getDropPos(d,board);
                if (p == player && dp != null) {
                    board[dp] = player+1;
                    player = ( player + 1 ) % 2;
                }
                let w = getWinningInfo(board);
                if (board.every(c=>c!=0)) w.push(true); // tie / draw
                server.dispatchEvent('sync',{board,player,w});
            }
        );

    setInterval(
        () => {
            let w = getWinningInfo(board);
            if (board.every(c=>c!=0)) w.push(true); // tie / draw
            server.dispatchEvent('sync',{board,player,w});
        },
        1000
    );

}

function runClient( addr, cb=()=>null ) {

    //\\

    let player = 0;
    let board = Array(42).fill(0);
    let selected = 4;
    let winner;

    //\\

    const sout = process.stdout;
    const sin  = process.stdin;

    const getch = () => new Promise(r=>sin.once('data',r));
    const mod   = (a,b) => ((a%b)+b)%b;

    let orm = sin.rawMode;
    sin.setRawMode(true);
    process.on('exit',()=>sin.setRawMode(orm));

    /**
     * Renders the specified cell and highlights it if indicated
     * @param {number} i the index of the cell to be rendered
     * @param {bool} h whether the cell should be highlighted or not
     * @returns {string} the rendered cell
     */
    function renderCell(i,h,rc) {
        let v = board[i];
        let dp = getDropPos(selected,board);
        return (h?'\x1b[7m':'') + (i==selected&&rc?'\x1b[53m':'') + ([dp==i&&rc?'\x1b[90m#':'.','\x1b[31m#','\x1b[34m#'][v]??'?') + '\x1b[m';
    }

    /**
     * Renders the board
     */
    function render() {
        let [w,highlighted] = getWinningInfo(board);
        if (board.every(c=>c!=0)) w = 3;
        sout.write(
            '\x1b[7A\x1b[G' + Array.from(Array(6),(_,r)=>Array.from(Array(7),(_,c)=>renderCell(r*7+c,(highlighted??[]).includes(r*7+c),!((w??-1)+1))).join('')).join('\n') + '\n' +
            ( w != null ?
                '       \n' :
                ( ' '.repeat(selected) + ['\x1b[31;1m','\x1b[34;1m'][player] + '~\x1b[39m' + ' '.repeat(7-selected) + '\n' ) )
            + '\x1b[m'
        );
        if (w != null) {
            console.log((['\x1b[31mPlayer 1','\x1b[34mPlayer 2','\x1b[90mNobody'][w]??'\x1b[33m?') + '\x1b[39m won'+(w==2?'.':' !'));
            process.exit();
        }
    }

    //\\

    const app = new appNetwork.App(addr)
        .addRequest( 'dropToken', true )
        .addEvent( 'sync', d => {
            ({board,w:winner,player} = d);
            render();
        });
    
    cb();


    //\\

    {(async()=>{
        sout.write('\n\n\n\n\n\n\n'); // leaves room for the board
        
        while (true) {
            render();
            let k = await getch();
            if (k == '\x1b[C') selected = mod(selected+1,7);
            if (k == '\x1b[D') selected = mod(selected-1,7);
            if (k == '\r') {
                app.sendRequest('dropToken',selected);
            }
            if (k == '\x03') break;
        }
    
        process.exit();
    })()}


}

module.exports = { runClient, runServer };
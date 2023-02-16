const net = require('node:net');
const path = require('node:path');
const os = require('node:os');

const {input,choice} = require('./input');
const apps = require('./apps.json');

choice('Select an app',{
    values: apps.map(a=>`\x1b[36m${a.name}\x1b[39m (${a.roomSize} users)`),
    rv    : apps,
    ln    : false,
    clear : true 
}).then(

    async appd => {

        let a = await choice(`\x1b[36m${appd.name}\x1b[39m`,{
            values: [
                'Host',
                'Join'
            ], 
            rv : [
                'host',
                'join'
            ],
            ln: false,
            clear: true
        });
        process.stdout.write({'host':'Hosting','join':'Joining'}[a]+` \x1b[36m${appd.name}\x1b[39m`);

        let app = require(path.resolve(__dirname,appd.path));

        if (a == 'host') {
            app.runServer(
                addr => {
                    console.log(` at ${addr.address} ${addr.port} (${os.hostname()})`);
                }
            );
        } else if (a == 'join') {
            console.log();
            let addr = await input('Address: ');
            let port = await input('Port: ');
            app.runClient({host:addr,port},()=>{
                console.log('\x1b[A\x1b[2K\x1b[A\x1b[2K\x1b[A\x1b[G\x1b[KJoined \x1b[36m'+appd.name+'\x1b[39m '+addr+'\x1b[90m:\x1b[39m'+port);
            });
        }

    }

);
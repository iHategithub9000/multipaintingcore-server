
//exception handler
process.on('uncaughtException', (error) => {
    console.log("[server] unhandled exception!");
    console.log(error.stack);
    
    try {
        clearInterval(wu_interval);
        console.log("[server] stopped world updater");
    } catch {}

    try {
        wss.clients.forEach((c) => {
            c.send(JSON.stringify({ operation: "kickm", m: "Server crashed" }));
            c.close();
        });
        console.log("[server] kicked players");
    } catch {}

    try {
        wss.close();
        console.log("[server] closed websocket");
    } catch {}
    try {
        rl.close();
        console.log("[server] closed command input");
    } catch {}
    console.log("[server] it is now safe to exit the application (CTRL-C)");
    setInterval(() => {}, 10);
});
//boot
var startTime = performance.now()
const WebSocket = require('ws');
const conf = require('./conf.json');
const wt = require('./worldtools.js');
const bm = require('./banman.js');
const wss = new WebSocket.Server({ port: conf.port });
console.log("[boot] websocket on")
const readline = require('readline');
console.log("[boot] cmdline input interface on")
const { v4: uuidv4 } = require('uuid');
const { parse } = require('path');
let clients = [];
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
let sbans = [];
if(!wt.worldExists(conf.world)){
    console.log("[boot] specified world doesn't exist, we'll generate one instead.")
    wt.generateWorld(conf.x, conf.y, conf.world)
}
console.log("[boot] loading world "+conf.world)
world = wt.getWorld(conf.world)
if (world[world.length-1].size[0]!=conf.x){
    throw new Error(`World size X isn't synced with config! (${world[world.length-1].size[0]} != ${conf.x})`)
}
if (world[world.length-1].size[1]!=conf.y){
    throw new Error(`World size Y isn't synced with config! (${world[world.length-1].size[1]} != ${conf.y})`)
}
if (world[world.length-1].size[0]!=world[0].length){
    throw new Error(`World size X isn't synced with amount of saved data! (${world[world.length-1].size[0]} != ${world[0].length})`)
}
if (world[world.length-1].size[1]!=world.length-1){
    throw new Error(`World size Y isn't synced with amount of saved data! (${world[world.length-1].size[1]} != ${world.length-1})`)
}

world.forEach((i,row)=>{
    try{
        i.forEach((a,cell)=>{
            if(![0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18].includes(a)){
                throw new Error("Invalid Cell ID in row "+row+" and cell "+cell+": "+a)
            }
        })
    } catch (e) {
        if (e instanceof TypeError) {
        } else {
          throw e;
        }
      }
})
var endTime = performance.now()
console.log("[boot] boot done in "+(endTime-startTime)+" ms")

//world updater
console.log("[server] saving world to file every "+conf['save-interval-ms']+" ms")
wu_interval=setInterval(()=>{
    wt.updateWorld(conf.world, world)
},conf['save-interval-ms'])

//ws connection
wss.on('connection', (ws, req) => {
    console.log("[wss] got a connection, woo!")
    ws.send(JSON.stringify({ operation: "motd", motd: conf.motd }));

    ws.on('message', (message) => {
        let parsedMessage;
        try {
            parsedMessage = JSON.parse(message);
        } catch (error) {
            ws.send(JSON.stringify({ operation: "kickm", m: "Data was impossible to parse: Data: "+message+", Error:"+error.toString()}));
            ws.close();
            return; // Optionally, send a message back to the client
        }

        

        if (parsedMessage.operation === "join") {
            console.log('[wss] got a join packet with body', parsedMessage)
            if(sbans.includes(parsedMessage.fingerprint)){
                ws.send(JSON.stringify({ operation: "kickm", m: "Session banned by console - you will be unbanned on server restart" }));
                ws.close()
            }
            if(bm.checkban(parsedMessage.fingerprint)){
                ws.send(JSON.stringify({ operation: "kickm", m: "Banned by console" }));
                ws.close()
            }
            console.log("[chat] "+parsedMessage.nick.toString().substring(0, 20).replaceAll("$","_")+" joined")
            clients.push({ ws: ws, req: req, fingerpr: parsedMessage.fingerprint, nick: parsedMessage.nick.toString().substring(0, 20).replaceAll("$","_") });
            ws.nick=parsedMessage.nick.toString().substring(0, 20).replaceAll("$","_")
            wss.clients.forEach((c)=>{
                c.send(JSON.stringify({ operation: "chat-m", data: parsedMessage.nick.toString().substring(0, 20).replaceAll("$","_")+" joined the server" }))
            })
            ws.send(JSON.stringify({ operation: "world", data: world }));
        }
        if (parsedMessage.operation === "fetch-players") {
            if(clients.some(client => client.ws === ws)){
                tmp=[];
                clients.forEach((c)=>{
                    tmp.push(c.nick)
                })
                ws.send(JSON.stringify({ operation: "plr", data: tmp}));
                tmp=[];
            } else {
                ws.send(JSON.stringify({ operation: "kickm", m: "Join the server first."}));
                ws.close()
            }
        }
        if (parsedMessage.operation === "chat") {
            if(clients.some(client => client.ws === ws)){
                console.log(`[chat] <${ws.nick}> ${parsedMessage.content}`)
                wss.clients.forEach((c)=>{
                    c.send(JSON.stringify({ operation: "chat-m", data: `<${ws.nick}> ${parsedMessage.content}` }))
                })
            } else {
                ws.send(JSON.stringify({ operation: "kickm", m: "Join the server first."}));
                ws.close()
            }
        }
        if (parsedMessage.operation === "cell") {
            if(clients.some(client => client.ws === ws)){
                if([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18].includes(parsedMessage.value)){
                    try{
                    world = wt.setCell(world, parsedMessage.x, parsedMessage.y, parsedMessage.value)
                    console.log("[server] "+ws.nick+" has set a cell at x "+parsedMessage.x+" and y "+parsedMessage.y+" to "+parsedMessage.value)
                    }catch{
                        "noop"
                    }
                }
                wss.clients.forEach((c)=>{
                    c.send(JSON.stringify({ operation: "world", data: world }))
                })
            } else {
                ws.send(JSON.stringify({ operation: "kickm", m: "Join the server first."}));
                ws.close()
            }
        }
    });

    ws.on('close', () => {
        clients = clients.filter(c => c.ws !== ws);
        wss.clients.forEach((c)=>{
            c.send(JSON.stringify({ operation: "chat-m", data: `${ws.nick} left the server` }))
        })
        console.log(`[chat] ${ws.nick} left the game`)
    });

    ws.on('error', (error) => {
        console.error(`Error: ${error}`);
        ws.send(JSON.stringify({ operation: "kickm", m: "An error occurred in the connection: " + error }));
        clients = clients.filter(c => c.ws !== ws); // Remove the client on error
        ws.close();
    });
});


//console
const promptUser = () => {
    rl.question('', (input) => {
        const command = input.split('$')[0];
        const args = input.split('$').slice(1);

        switch (command) {
            case 'chat':
                const chatMessage = args.join('$');
                console.log(`[chat] <CONSOLE> ${chatMessage}`);
                wss.clients.forEach((c) => {
                    c.send(JSON.stringify({ operation: "chat-m", data: `<CONSOLE> ${chatMessage}` }));
                });
                break;
            
            case 'row':
                console.log(world[args[0]].join(","))
                break;

            case 'val':
                console.log(world[args[0]][args[1]])
                break;

            case 'map':
                console.log(world.join(";"))
                break;

            case 'cor':
                world[world.length-1].size=[-1,-1]
                wt.updateWorld(conf.world, world)
                console.log("[command|cor] world updated");
                break;

            case 'kick':
                wss.clients.forEach((c) => {
                    clients.forEach((cd) => {
                        if (cd.nick===args[0]) {
                            c.send(JSON.stringify({ operation: "kickm", m: "Kicked by console" }));
                            c.close();
                            console.log("[command|kick] player has been kicked");
                        }
                    });
                });
                break;

            case 'ban':
                wss.clients.forEach((c) => {
                    clients.forEach((cd) => {
                        if (cd.nick===args[0]) {
                            c.send(JSON.stringify({ operation: "kickm", m: "Banned by console" }));
                            c.close();
                            bm.ban(cd.fingerpr);
                            console.log("[command|ban] player has been banned");
                        }
                    });
                });
                break;

            case 'cell':
                if (args.length === 3) {
                    world = wt.setCell(world, parseInt(args[0]), parseInt(args[1]), parseInt(args[2]));
                    wss.clients.forEach((c)=>{
                        c.send(JSON.stringify({ operation: "world", data: world }))
                    })
                    console.log("[command|cell] successfully replaced cell and sent new world");
                } else {
                    console.log("[command|cell] syntax error");
                }
                break;

            case 'shutdown':
                
                clearInterval(wu_interval);
                console.log("[command|shutdown] stopped world updater");
                wss.clients.forEach((c) => {
                    c.send(JSON.stringify({ operation: "kickm", m: "Server closed" }));
                    c.close();
                });
                console.log("[command|shutdown] kicked players");
                wss.close();
                console.log("[command|shutdown] closed websocket");
                rl.close();
                console.log("[command|shutdown] closed command input");
                console.log("[command|shutdown] it is now safe to exit the application (CTRL-C)");
                setInterval(() => {}, 10);
                return; // End the function after shutdown

            case 'sban':
                wss.clients.forEach((c) => {
                    clients.forEach((cd) => {
                        if (cd.nick===args[0]) {
                            c.send(JSON.stringify({ operation: "kickm", m: "Session banned by console - you will be unbanned on server restart" }));
                            c.close();
                            sbans.push(cd.remote);
                            console.log("[command|sban] player has been session banned");
                        }
                    });
                });
                break;
            case 'c':
                throw new Error("Console entered 'c' (crash command)");
                break;

            default:
                console.log("[command] syntax error");
        }
        promptUser();
    });
};

promptUser();

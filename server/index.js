import express from 'express' //módulo para aplicaciones web de node.js
import logger from 'morgan' //registra solicitudes HTTP en la consola.
import { Server } from 'socket.io'; //manejar el servidos de websockets
import {createServer} from 'node:http'; //módulo para crear servidores http
import dotenv from 'dotenv'
import { createClient } from '@libsql/client';

dotenv.config()

const port = process.env.port ?? 3000 //constante para el puerto

const app = express(); //inicializamos nuestra aplicación llamado a express
const server = createServer(app) //creamos el servidor http
const io = new Server(server, {
    connectionStateRecovery: {}
}); //servidor de websocket

const db = createClient({
    url: 'libsql://dear-vision-ar-06.turso.io',
    authToken: process.env.DB_TOKEN

})

await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    user TEXT
    )
`)


io.on('connection', async(socket) => {
    console.log('Usuario conectado')

    socket.on('disconnect',()=> {
        console.log('Usuario desconectado')
    });

    socket.on('chat message', async(msg) => {
        let result 
        const username = socket.handshake.auth.username ?? 'anonymous'
        try {

            result = await db.execute ({
                sql: 'INSERT INTO messages (content, user) VALUES (:msg, :username)',
                args: { msg, username }
            })
        } catch (e) {
            console.error(e)
            return
        }


        io.emit('chat message', msg, result.lastInsertRowid.toString(), username); //servidor recibe el mensaje
    })

    if (!socket.recovered) { // recupere los mensajes sin conexión
        try {
           const results = await db.execute({
            sql: 'SELECT id, content, user FROM messages WHERE id > ?',
            args: [socket.handshake.auth.serverOffset ?? 0]
        }); 

        results.rows.forEach (row => {
            socket.emit('chat message', row.content, row.id.toString(), row.user)
        })

        } catch (e){
            console.error(e); 
        }
    }
});




app.use(logger('dev')) //Ver el status de nuestro login

app.get('/', (req,res) => {
    res.sendFile(process.cwd() + '/client/index.html') //servimos el html
});


server.listen(port,() => {
    console.log(`Servidor corriendo en puerto ${port}`);
});


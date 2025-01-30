import express from "express";
import http from 'http'
import cors from 'cors'
import { Server } from 'socket.io'
import { createClient, RedisClientType } from "redis";
import RedisClient from "@redis/client/dist/lib/client";
import { client } from "./db";

const app = express();
app.use(express.json());
app.use(cors())

let redis:RedisClientType;
async function createRedisClient(){
    redis = createClient()
    redis.on('error',(error)=>{console.log("Redis client error ", error)})
    await redis.connect()
    console.log("connected to redis")
}

createRedisClient()


const server = http.createServer(app);
const socketio = new Server(server,{
    cors:{
        origin:'*'
    }
})

socketio.on('connection',(socket)=>{
    console.log('connection')
    socket.on('authConnection',async (userId)=>{
        console.log("user with id :",userId ," is connected")
        await redis.set(`user:${userId}`,socket.id,{
            EX:3600
        })
        socket.on('messageUser',async ({recieverId,message})=>{
            const senderSocket = await redis.get(`user:${recieverId}`)
            console.log(message)
            // await client.messages.create({
            //     data:{
            //         senderId:userId,
            //         recieverId:recieverId,
            //         message:message
            //     }
            // })
            if(senderSocket){
                socket.to(senderSocket).emit('messageUser',message)
            }
        })
        socket.on('disconnect',async ()=>{
            
            console.log("user with id :",userId ," is disconnected")
        })
    })
    
    
})


server.listen(8000)






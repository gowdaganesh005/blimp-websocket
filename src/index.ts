import express from "express";
import http from 'http'
import cors from 'cors'
import { Server } from 'socket.io'
import { createClient, RedisClientType } from "redis";
import { client } from "./db";
import dotenv from "dotenv"

dotenv.config()

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
        await redis.set(`user:${userId}`,socket.id)

        
        async function popAllMessages(){
            let OfflineMessages=[];
            let msg
            while( (msg = await redis.rPop(`OfflineMessages:${userId}`)) !== null ){
                msg = JSON.parse(msg)
                OfflineMessages.push(msg)
            }
            return OfflineMessages;
        }
        const OfflineMessages = await popAllMessages()
        if(OfflineMessages.length != 0){

            OfflineMessages.forEach(ele=>{
                socket.to(socket.id).emit('messageUser',ele)
            })
            
        }
        
        socket.on('messageUser',async ({recieverId,payload}:any)=>{
            const senderSocket = await redis.get(`user:${recieverId}`)
            console.log(senderSocket)
            console.log(payload)
            
            const data = await client.messages.create({
                data:{
                    senderId:userId,
                    recieverId:recieverId,
                    message:payload.message,
                }
            })
            if(data!=null){
                const parsedMessage = {
                    message:data.message,
                    sender:data.senderId,
                    timeStamp:data.timestamp,
                    msgId:data.msgId
                }
                
                if(senderSocket){
                    socket.to(senderSocket).emit('messageUser',parsedMessage)
                    await client.messages.update({
                        where:{
                            msgId: data.msgId
                        },
                        data:{
                            read:true
                        }
                    })
                }
                else{
                    await redis.incr(`UnReadMessages:${recieverId}`)
                    console.log(`OfflineMessageUsers:${recieverId}-${userId}`)
                    await redis.incr(`OfflineMessageUsers:${recieverId}-${userId}`)   
                }
            }
            
        })
        socket.on('disconnect',async ()=>{
            await redis.del(`user:${userId}`)
            
            console.log("user with id :",userId ," is disconnected")
        })
    })
    
    
})


server.listen(8000)






import { Queue } from "bullmq";
import IORedis from "ioredis";
type JobName="inbound.parse"|"outbound.send"|"ses.event";
let connection:IORedis|undefined;let queue:Queue|undefined;
function getQueue(){if(!process.env.REDIS_URL)throw new Error("REDIS_URL is required.");connection??=new IORedis(process.env.REDIS_URL,{maxRetriesPerRequest:null,enableReadyCheck:true});queue??=new Queue("olv-mail",{connection,defaultJobOptions:{attempts:5,backoff:{type:"exponential",delay:2000},removeOnComplete:{age:86400,count:1000},removeOnFail:false}});return queue;}
export async function enqueue(name:JobName,data:Record<string,unknown>,idempotencyKey:string){return getQueue().add(name,data,{jobId:idempotencyKey.replace(/[^a-zA-Z0-9_-]/g,"_")});}

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { CreateEmailIdentityCommand, DeleteEmailIdentityCommand, GetEmailIdentityCommand, SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

let s3Client:S3Client|undefined; let sesClient:SESv2Client|undefined;
function localCredentials(){
  const path=process.env.AWS_CREDENTIALS_JSON_FILE;
  if(!path)return undefined;
  const parsed=JSON.parse(readFileSync(path,"utf8")) as {AccessKey?:{AccessKeyId?:string;SecretAccessKey?:string;SessionToken?:string}};
  const key=parsed.AccessKey;
  if(!key?.AccessKeyId||!key.SecretAccessKey)throw new Error("AWS_CREDENTIALS_JSON_FILE does not contain a valid access key.");
  return {accessKeyId:key.AccessKeyId,secretAccessKey:key.SecretAccessKey,sessionToken:key.SessionToken};
}
function clients(){const c={S3_REGION:process.env.S3_REGION||"",SES_REGION:process.env.SES_REGION||"",S3_BUCKET:process.env.S3_BUCKET||"",SES_CONFIGURATION_SET:process.env.SES_CONFIGURATION_SET||""};for(const [key,value] of Object.entries(c))if(!value)throw new Error(`${key} is required.`);const credentials=localCredentials();s3Client??=new S3Client({region:c.S3_REGION,maxAttempts:5,credentials});sesClient??=new SESv2Client({region:c.SES_REGION,maxAttempts:5,credentials});return {s3:s3Client,ses:sesClient,c};}
export type DnsRecord={type:"TXT"|"CNAME"|"MX";host:string;value:string;purpose:string;required:boolean};
export interface MailProvider { createDomainIdentity(domain:string):Promise<DnsRecord[]>; checkDomainIdentity(domain:string):Promise<{identity:boolean;dkim:boolean;mailFromDomain:string|null;mailFromVerified:boolean}>; sendRaw(raw:Uint8Array):Promise<string>; }
export class SesMailProvider implements MailProvider {
  async createDomainIdentity(domain:string){const {ses,c}=clients();let response;try{response=await ses.send(new CreateEmailIdentityCommand({EmailIdentity:domain,DkimSigningAttributes:{NextSigningKeyLength:"RSA_2048_BIT"}}));}catch(error){if((error as {name?:string}).name!=="AlreadyExistsException")throw error;response=await ses.send(new GetEmailIdentityCommand({EmailIdentity:domain}));}const tokens=response.DkimAttributes?.Tokens||[];return [...tokens.map(token=>({type:"CNAME" as const,host:`${token}._domainkey.${domain}`,value:`${token}.dkim.amazonses.com`,purpose:"SES DKIM",required:true})),{type:"MX" as const,host:domain,value:`10 inbound-smtp.${c.SES_REGION}.amazonaws.com`,purpose:"Inbound mail",required:true},{type:"TXT" as const,host:domain,value:"v=spf1 include:amazonses.com -all",purpose:"SPF",required:true},{type:"TXT" as const,host:`_dmarc.${domain}`,value:`v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,purpose:"DMARC",required:false}];}
  async checkDomainIdentity(domain:string){const {ses}=clients();const result=await ses.send(new GetEmailIdentityCommand({EmailIdentity:domain}));return {identity:result.VerifiedForSendingStatus===true,dkim:result.DkimAttributes?.Status==="SUCCESS",mailFromDomain:result.MailFromAttributes?.MailFromDomain||null,mailFromVerified:result.MailFromAttributes?.MailFromDomainStatus==="SUCCESS"};}
  async deleteDomainIdentity(domain:string){const {ses}=clients();try{await ses.send(new DeleteEmailIdentityCommand({EmailIdentity:domain}));}catch(error){if((error as {name?:string}).name!=="NotFoundException")throw error;}}
  async sendRaw(raw:Uint8Array){const {ses,c}=clients();const result=await ses.send(new SendEmailCommand({Content:{Raw:{Data:raw}},ConfigurationSetName:c.SES_CONFIGURATION_SET}));if(!result.MessageId)throw new Error("SES did not return a message ID.");return result.MessageId;}
}
export async function putPrivateObject(prefix:string,body:Uint8Array,contentType:string){const {s3,c}=clients();const key=`${prefix}/${randomUUID()}`;await s3.send(new PutObjectCommand({Bucket:c.S3_BUCKET,Key:key,Body:body,ContentType:contentType,ServerSideEncryption:"AES256"}));return key;}
export async function readPrivateObject(key:string){const {s3,c}=clients();const output=await s3.send(new GetObjectCommand({Bucket:c.S3_BUCKET,Key:key}));if(!output.Body)throw new Error("S3 object has no body.");return output.Body.transformToByteArray();}
export async function signedAttachmentUrl(key:string){const {s3,c}=clients();return getSignedUrl(s3,new GetObjectCommand({Bucket:c.S3_BUCKET,Key:key}),{expiresIn:300});}

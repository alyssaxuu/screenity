class Chunks {
    constructor(chunk, PartNumber){
        this.chunk = chunk
        this.partNumber = PartNumber
    }
}
const MIN_SIZE = 6000000
const BASE_URL = "https://bauuv39b7h.execute-api.us-east-1.amazonaws.com/dev/";

class AWSStorage {

    constructor(FileName){
        this.FileName = FileName
        this.startUploadPromise=this.startUpload(FileName)
        this.uploaded = {}
        this.chunks = []
        this.promises = []
        this.promisesPart = []
        this.UploadId = null
        this.PartNumber = 1
    }

    startUpload = async (uuid) => {
        const START_MULTIPARTUPLOAD_URL = "upload/start"
        const res = await fetch(BASE_URL + START_MULTIPARTUPLOAD_URL + "?FileName="+ uuid)
        console.log("In the startMultiUpload Request" + res)
        return res.json()
    }

    uploadPartUtil = async (newChunk) => {
        if (!this.UploadId){
            const res = await this.startUploadPromise
            this.UploadId = res.UploadId
            console.log('The startUpload request is not executed');
        }
        const partNumber = this.currentPartNumber()
        const UploadUrl = await (await this.getUploadUrl(partNumber, newChunk.type));
        console.log('The uploadURL is', UploadUrl);
        const res = fetch(UploadUrl, {
            method: 'PUT',
            headers: {
                ContentType: newChunk.type,
                // 'x-amz-acl': 'public-read'
            },
            body: newChunk
        })
        this.uploaded[partNumber] = true
        this.promises.push(res);
        this.promisesPart.push(partNumber)
        return
    }

    uploadPart = async (chunk) => {
        const newChunk = this.appendChunk(chunk)
        if (newChunk.size < MIN_SIZE){
            return
        }
        if (!this.UploadId){
            const res = await this.startUploadPromise
            this.UploadId = res.UploadId
            console.log('The startUpload request is not executed');
        }
        return this.uploadPartUtil(newChunk)
        // console.log('The uploadVideo part', res)
        // return {ETag: res.headers.get('ETag')}
    }

    completeUpload = async () => {
        var request = {
            FileName: this.FileName,
            UploadId: this.UploadId,
            Parts: []
        }
        // await this.uploadRemainingChunk()
       const re = await Promise.all(this.promises)
        for ( let i = 0 ; i < re.length ;i++){
            request.Parts.push({
                PartNumber: this.promisesPart[i],
                ETag: re[i].headers.get('ETag')
            })
        }

        const COMPLETE_UPLOAD = "upload/complete"
        console.log('In the completeUpload method', request);
        const res = await fetch( BASE_URL + COMPLETE_UPLOAD,{
            method: 'POST',
            headers: {
                // 'Content-type': 'application/json; charset=UTF-8'
            },
            body: JSON.stringify(request)
        })
        const json = await res.json()
        console.log('The result of the complete Upload is', json);
        return json

    }

    // pauseUpload = () => {

    // }

    // stopUpload = () => {

    // }

    uploadRemainingChunk = () => {
        if (this.uploaded[this.currentPartNumber()] === false){
            return this.uploadPartUtil(this.chunks[this.chunks.length - 1].chunk)
        }
    }

    nextPartNumber = () => {
        return this.chunks.length + 1
    }

    currentPartNumber = () => {
        return this.chunks.length;
    }

    appendChunk = (chunk) => {
        if (this.chunks.length === 0){
            this.chunks.push(new Chunks(chunk, this.nextPartNumber()))
            this.uploaded[this.currentPartNumber()] = false
            return chunk
        } else {
            const oldChunk = this.chunks[this.chunks.length -1]['chunk']
            var newChunk = chunk
            if (oldChunk.size < MIN_SIZE ){
                newChunk = new Blob([oldChunk, chunk], {type: oldChunk.type})
                this.chunks.pop()
            }
            this.chunks.push(new Chunks(newChunk, this.nextPartNumber()))
            this.uploaded[this.currentPartNumber()] = false
            return newChunk
        }
    }

    getUploadUrl = async (PartNumber, ContentType) => {
        const GET_URL = "upload/url"
        const res = await fetch(BASE_URL + GET_URL + "?FileName="+this.FileName+"&PartNumber="+PartNumber+"&UploadId="+this.UploadId + "&ContentType=" + ContentType)
        console.log("In get Upload URL Request" + res)
        return res.json()
    }
}

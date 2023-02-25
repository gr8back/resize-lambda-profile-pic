// resize.js
const stream = require('stream')

const AWS = require('aws-sdk')
const sharp = require('sharp')
const S3 = new AWS.S3({
  signatureVersion: 'v4'
})
AWS.config.region = process.env.$AWS_REGION; // Region


// create constants
const BUCKET = process.env.$AWS_BUCKET
const REGION = process.env.$AWS_REGION
const REDIRECTURL = `http://s3.${REGION}.amazonaws.com/${BUCKET}`

// create the read stream abstraction for downloading data from S3
const readStreamFromS3 = ({ Bucket, Key }) => {
  console.log("read stream from s3")
  return S3.getObject({ Bucket, Key }).createReadStream()
}
// create the write stream abstraction for uploading data to S3
const writeStreamToS3 = ({ Bucket, Key }) => {
  console.log("write stream from s3")
  const pass = new stream.PassThrough()
  return {
    writeStream: pass,
    uploadFinished: S3.upload({
      Body: pass,
      Bucket,
      ContentType: 'image/png',
      Key
    }).promise()
  }
}
// sharp resize stream
const streamToSharp = ({ width, height }) => {
  return sharp()
    .resize(width, height)
    .toFormat('png')
}

exports.handler = async (event) => {
  console.log("event " + JSON.stringify(event))
  console.log("event object key is " + event.Records[0].s3.object.key)
  const imagedir = event.Records[0].s3.object.key
  const originalKey = imagedir.split('/')[1]
  const width = 250
  const height = 250
  const newKey = originalKey
  console.log("original key " + originalKey + " newkey " + newKey)


  try {
    const readStream = readStreamFromS3({ Bucket: BUCKET, Key: imagedir })
    const resizeStream = streamToSharp({ width, height })
    const {
      writeStream,
      uploadFinished
    } = writeStreamToS3({ Bucket: BUCKET, Key: newKey })

    // trigger the stream
    readStream
      .pipe(resizeStream)
      .pipe(writeStream)

    // wait for the stream to finish
    const uploadedData = await uploadFinished

    return {
      statusCode: '200',
      headers: { 'location': newKey },
      body: 'testbody'
    }
  } catch (err) {
    console.error(err)
    return {
      statusCode: '500',
      body: err.message
    }
  }
}

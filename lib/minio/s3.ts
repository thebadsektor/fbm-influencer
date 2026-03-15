import * as Minio from 'minio';

const s3Client = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT!,
    port: parseInt(process.env.MINIO_PORT!, 9000),
    useSSL: true, // Set to 'true' if you have a configured SSL certificate
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
});


export default s3Client;

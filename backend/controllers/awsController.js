const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'minio',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'minio123',
    endpoint: process.env.AWS_ENDPOINT || 'http://localhost:9000',
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
});

const getPresignedUrl = async (req, res) => {
    try {
        const { ctrb_id, component, filename, content_type } = req.body;

        const fileExtension = filename.split('.').pop();
        const key = `inspections/${ctrb_id}/${component}/${uuidv4()}.${fileExtension}`;

        const params = {
            Bucket: process.env.AWS_BUCKET_NAME || 'ctrb-bucket',
            Key: key,
            Expires: 300, // 5 minutes
            ContentType: content_type
        };

        const url = await s3.getSignedUrlPromise('putObject', params);

        res.status(200).json({ data: { url, key, expiry: 300 } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error generating URL' });
    }
};

const getPhotoUrl = async (req, res) => {
    try {
        const { key } = req.params;
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME || 'ctrb-bucket',
            Key: key,
            Expires: 3600 // 1 hour
        };
        const signed_url = await s3.getSignedUrlPromise('getObject', params);
        res.status(200).json({ signed_url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
}

module.exports = { getPresignedUrl, getPhotoUrl };

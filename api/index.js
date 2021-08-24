const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors')
const { Keyring } = require('@polkadot/keyring');

const AWS = require('aws-sdk')

const { VerifiableCredentialUtil, generateUnique } = require('./VerifiableCredentialUtil');
const { TrackBackAgent } = require('./TrackBackAgent');

const { v4: UUID } = require('uuid');
const Busboy = require('busboy');

const S3 = new AWS.S3();

const PORT = process.env.PORT || 8080;
const BUCKET_NAME = 'trackback-demo-vc-issuer'

const app = express();
app.use(bodyParser.json());
app.disable('x-powered-by');

app.use(cors());

app.options('*', cors())

app.get('/api/status', function (req, res) {
    res.status(200).end();
});

app.post('/api/v1/register', async (req, res) => {

    const { name: firstName, lastName, dob, photo, bloodType } = req.body || {};

    await TrackBackAgent.connect();

    // Create a keyring instance
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');

    const didLicence = TrackBackAgent.createDID();

    await TrackBackAgent.addDidToChain(alice, didLicence.didDocument, didLicence.did_uri)

    const imageUri = "https://issuer-ta.trackback.dev/api/v1/images?image=" + Buffer.from(photo).toString('base64')

    const driverLicence = await VerifiableCredentialUtil.createDrivingLicenseVCS({
        firstNames: firstName,
        surname: lastName,
        dateOfBirth: dob,
        licence: generateUnique().toUpperCase(),
        version: "234",
        dateOfExpiry: "2028-01-01",
        entitilements: `Class 1`,
        didUri: didLicence.did_uri,
        imageUri,
        bloodType
    })

    for (const key of driverLicence.partialVCS) {
        await TrackBackAgent.addVCPhashToChain(alice, key, alice.address)
    }

    res.status(200).json({

        vc:
        {
            type: "DigitalDriverLicenceCredential",
            name: "New Zealand Driver Licence",
            department: "Trackback Transport Athority",
            vcs: driverLicence,
            didUri: didLicence.did_uri
        }

    })
});


app.get('/api/v1/images', (req, res) => {

    if (!req.image) {
        return res.sendStatus(400);
    }

    const image = Buffer.from(req.image, 'base64').toString('ascii')

    var getParams = {
        Bucket: BUCKET_NAME, // your bucket name,
        Key: image
    }

    S3.getObject(getParams, function (err, data) {
        // Handle any error and exit
        if (err){
            return res.sendStatus(400);
        }
            

        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.write(data.Body, 'binary');
        res.end(null, 'binary');
    });

});



app.post('/api/v1/image-upload', (req, res) => {

    let chunks = [], fname, ftype, fEncoding;
    let busboy = new Busboy({ headers: req.headers });
    busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
        console.log('File [' + fieldname + ']: filename: ' + filename + ', encoding: ' + encoding + ', mimetype: ' + mimetype);
        fname = filename.replace(/ /g, "_");
        ftype = mimetype;
        fEncoding = encoding;
        file.on('data', function (data) {
            chunks.push(data)
        });
        file.on('end', function () {
            console.log('File [' + filename + '] Finished');
        });
    });
    busboy.on('finish', function () {
        const userId = UUID();
        const params = {
            Bucket: BUCKET_NAME, // your s3 bucket name
            Key: `images/${userId}-${fname}`,
            Body: Buffer.concat(chunks), // concatinating all chunks
            ContentEncoding: fEncoding, // optional
            ContentType: ftype // required
        }
        // we are sending buffer data to s3.
        S3.upload(params, (err, s3res) => {
            if (err) {
                res.send({ err, status: 'error' });
            } else {
                res.send({ data: s3res, status: 'success', msg: 'Image successfully uploaded.' });
            }
        });

    });
    req.pipe(busboy);


    // {
    //     "data": {
    //         "ETag": "\"989e51b9be3ab7664e351f172bc4395e\"",
    //         "Location": "https://trackback-demo-vc-issuer.s3-ap-southeast-2.amazonaws.com//images/bda90060-d780-4e5a-a644-e36bcff4b03b-me1.jpg",
    //         "key": "/images/bda90060-d780-4e5a-a644-e36bcff4b03b-me1.jpg",
    //         "Key": "/images/bda90060-d780-4e5a-a644-e36bcff4b03b-me1.jpg",
    //         "Bucket": "trackback-demo-vc-issuer"
    //     },
    //     "status": "success",
    //     "msg": "Image successfully uploaded."
    // }
})


const server = app.listen(PORT, async function () {
    console.log(`SERVER LISTENING ${PORT}`);
});

console.log('Trackback Transport Athority AGENT SERVER STARTING');

process.on('uncaughtException', function (exception) {
    console.log(exception);
    // process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server')
    server.close(() => {
        console.log('HTTP server closed')
    })
});

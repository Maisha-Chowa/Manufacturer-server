const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const ObjectId = require("mongodb").ObjectId;
const app = express();
const port = process.env.PORT || 5000;
//const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const stripe = require("stripe")(
  "sk_test_51L3hDdKGemxaXFrEiM4fjr7OKFkyzLoasZ0bIP1krClI10ocoTgPx436J6xWzDbYgOyDzWM1DSYMgj8sUDS1v1N700bEaCYbnl"
);

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://manufacturer:xVXR3X6HbVZMbHPj@manufacturer.rmjj6.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    console.log("db connected");

    const toolsCollection = client.db("manufacturer").collection("Tools");
    const purchaseCollection = client
      .db("manufacturer")
      .collection("PurchaseInfo");
    const userCollection = client.db("manufacturer").collection("user");
    const reviewCollection = client.db("manufacturer").collection("reviews");
    const paymentCollection = client.db("manufacturer").collection("payments");
    const profileCollection = client.db("manufacturer").collection("profile");

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    };

    //get all the tools
    app.get("/tools", async (req, res) => {
      const query = {};
      const cursor = toolsCollection.find(query);
      const Tools = await cursor.toArray();
      res.send(Tools);
    });
    app.get("/tools", verifyJWT, verifyAdmin, async (req, res) => {
      const Tools = await toolsCollection.find().toArray();
      res.send(Tools);
    });

    //get single tools
    app.get("/tools/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await toolsCollection.findOne(query);
      res.send(result);
    });
    //post product api
    app.post("/tools", verifyJWT, verifyAdmin, async (req, res) => {
      const product = req.body;
      console.log(product);
      const result = await toolsCollection.insertOne(product);
      res.send(result);
    });
    //delete product
    app.delete("/tools/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: ObjectId(id) };
      const filter = { _id: ObjectId(id) };
      //const filter = { n: email };
      // const result = await toolsCollection.deleteOne(query);
      const result = await toolsCollection.deleteOne(filter);

      res.send(result);
    });

    //get purchase data
    app.get("/purchaseinfo", verifyJWT, async (req, res) => {
      // const query = {};
      // const PurchaseInfo = await purchaseCollection.find(query).toArray();
      // res.send(PurchaseInfo);
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email === decodedEmail) {
        const query = { email: email };
        const PurchaseInfo = await purchaseCollection.find(query).toArray();
        return res.send(PurchaseInfo);
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    });
    //get single purchase product
    app.get("/purchaseinfo/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const PurchaseInfo = await purchaseCollection.findOne(query);
      res.send(PurchaseInfo);
    });

    app.patch("/purchaseinfo/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };

      const result = await paymentCollection.insertOne(payment);
      const updatedBooking = await purchaseCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(updatedBooking);
    });
    //post purchase data
    app.post("/purchaseinfo", async (req, res) => {
      const PurchaseInfo = req.body;
      const result = await purchaseCollection.insertOne(PurchaseInfo);
      console.log(PurchaseInfo);
      return res.send({ success: true, result });
    });

    ///upsert user data
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    //get All users
    app.get("/user", verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
    // make admin
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      console.log("admin", user);
      const isAdmin = user.role === "admin";
      console.log(isAdmin);
      res.send({ admin: isAdmin });
    });

    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //get all reviews
    app.get("/reviews", async (req, res) => {
      const query = {};
      const cursor = reviewCollection.find(query);
      const reviews = await cursor.toArray();
      res.send(reviews);
    });
    //post review
    app.post("/reviews", async (req, res) => {
      const reviewInfo = req.body;
      const result = await reviewCollection.insertOne(reviewInfo);
      console.log(reviewInfo);
      return res.send({ success: true, result });
    });

    //get all profile
    app.get("/profile", async (req, res) => {
      const query = { email: email };
      const cursor = profileCollection.findOne(query);
      const profile = await cursor.toArray();
      res.send(profile);
    });
    //post profile
    app.post("/profile", async (req, res) => {
      const profileInfo = req.body;
      const result = await profileCollection.insertOne(profileInfo);
      console.log(profileInfo);
      return res.send({ success: true, result });
    });

    //payment
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const tool = req.body;
      console.log(tool);
      const price = tool.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
  } finally {
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("manufacturer server");
});

app.listen(port, () => {
  console.log("Listening to the port", port);
});

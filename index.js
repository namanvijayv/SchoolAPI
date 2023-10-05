const cors = require("cors");
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path'); // Import the 'path' module
const { Chart } = require('chart.js');
const moment = require('moment-timezone');
const http = require('http');
const socketIo = require('socket.io');


// Create an Express application
const app = express();
app.use(cors());
const port = 3000;

// Parse JSON request bodies
app.use(bodyParser.json());

// Define MongoDB connection string
const mongoURI =
  "mongodb+srv://ravi:HelloWorld%401234@rechargeapp.9uks18k.mongodb.net/SchoolDB";

// Connect to MongoDB
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define a MongoDB Schema for students
const studentSchema = new mongoose.Schema({
  name: String,
  age: Number,
  class: Number,
  section: String,
  contactNumber: String,
  appRegNumber: String,
  motherName: String,
  fatherName: String,
  address: String,
  loginID: String,
  password: String,
  presentDates: [Date],
  absentDates: [Date],
});

// Pre-save hook to generate loginID and password
studentSchema.pre("save", function (next) {
  const student = this;
  const randomWord = Math.random().toString(36).substring(2, 5).toUpperCase(); // Random 3-character word (in uppercase)
  const randomNumbers = Math.random().toString().substring(2, 6); // Random 4-digit number

  // Construct loginID and password based on the provided criteria
  student.loginID = randomWord + randomNumbers;
  student.password =
    student.name.substring(0, 3) + student.appRegNumber.substring(0, 4);

  next();
});

// Create a MongoDB model for students
const Student = mongoose.model("Student", studentSchema);

// Define a route to save a student
app.post("/students", async (req, res) => {
  try {
    const {
      name,
      age,
      class: studentClass,
      section,
      contactNumber,
      appRegNumber,
      motherName,
      fatherName,
      address,
    } = req.body;

    const student = new Student({
      name,
      age,
      class: studentClass,
      section,
      contactNumber,
      appRegNumber,
      motherName,
      fatherName,
      address,
    });

    await student.save();
    res.status(201).json(student);
  } catch (error) {
    res.status(500).json({ error: "Could not save student" });
    console.log(error);
  }
});

// Define a route to get students by class
app.get("/get-students", async (req, res) => {
  try {
    const className = req.query.class;

    // If className is not provided, retrieve all students
    const query = className ? { class: className } : {};

    const students = await Student.find(query);
    res.status(200).json(students);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Define a route to get a student by loginID
app.get('/get-student/loginID/:loginID', async (req, res) => {
  try {
    const loginID = req.params.loginID;

    // Find the student by loginID
    const student = await Student.findOne({ loginID: loginID });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.status(200).json(student);
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch student' });
  }
});


app.get("/get-classes", async (req, res) => {
  try {
    const classes = await Student.distinct("class");
    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ error: "Could not fetch classes" });
  }
});

// Delete a student by loginID
app.delete("/students/loginID/:loginID", async (req, res) => {
  try {
    const loginID = req.params.loginID;

    // Delete the student record from the database using loginID
    const deletedStudent = await Student.findOneAndRemove({ loginID: loginID });

    if (!deletedStudent) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Could not delete student" });
  }
});

// Login route
app.post("/login", async (req, res) => {
  try {
    const { loginID, password } = req.body;

    // Find the student with the provided loginID
    const student = await Student.findOne({ loginID: loginID });

    if (!student) {
      return res
        .status(401)
        .json({ error: "Login failed. Invalid loginID or password." });
    }

    // Check if the provided password matches the student's password
    if (password !== student.password) {
      return res
        .status(401)
        .json({ error: "Login failed. Invalid loginID or password." });
    }

    // Authentication successful
    res.status(200).json({ message: "Login successful", loginID: student.loginID });
  } catch (error) {
    res.status(500).json({ error: "Login failed. Internal server error." });
  }
});

// Define a MongoDB Schema for visitors with separate date and time fields
const visitorSchema = new mongoose.Schema({
  name: String,
  purpose: String,
  toWho: String,
  mobile: String,
  visitorID: String,
  visitDate: String,
  visitTime: String,
  leaveTime: String,
});

const Visitor = mongoose.model("Visitor", visitorSchema);

// Create a new visitor entry
app.post('/visitors', async (req, res) => {
  try {
    const { name, purpose, toWho, mobile } = req.body;

    // Generate a random 6-digit numeric ID for the visitor
    const visitorID = Math.floor(100000 + Math.random() * 900000).toString();

    // Get the current date and time in your desired time zone
    const currentDate = moment.tz('Asia/Kolkata'); // Replace 'YourTimeZone' with the desired time zone, e.g., 'Asia/Kolkata'
    const visitDate = currentDate.format('YYYY-MM-DD'); // Get date in "YYYY-MM-DD" format
    const visitTime = currentDate.format('hh:mm A'); // Get time in "hh:mm AM/PM" format

    const visitor = new Visitor({
      name,
      purpose,
      toWho,
      mobile,
      visitorID,
      visitDate,
      visitTime,
    });

    await visitor.save();
    res.status(200).json({ result: 'Entry Successful' });
  } catch (error) {
    res.status(500).json({ error: 'Could not save visitor' });
    console.log(error)
  }
});

// Define a route to get all visitors
app.get("/get-visitors", async (req, res) => {
  try {
    const visitors = await Visitor.find();
    res.status(200).json(visitors);
  } catch (error) {
    res.status(500).json({ error: "Could not fetch visitors" });
  }
});


//GRAPH

// Define a route to plot a bar graph of total visitors per day
app.get('/total-visitors-per-day', async (req, res) => {
  try {
    // Retrieve all visitor records
    const visitors = await Visitor.find();

    // Create an object to store the total visitors per day
    const visitorsPerDay = {};

    // Calculate the total visitors for each day
    visitors.forEach((visitor) => {
      const { visitDate } = visitor;
      if (visitorsPerDay[visitDate]) {
        visitorsPerDay[visitDate]++;
      } else {
        visitorsPerDay[visitDate] = 1;
      }
    });

    // Extract the dates and visitor counts for chart data
    const dates = Object.keys(visitorsPerDay);
    const visitorCounts = Object.values(visitorsPerDay);

    // Generate a simple HTML page with the chart
const chartHtml = `
<html>
  <head>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  </head>
  <body>
    <canvas id="visitorChart" width="400" height="200"></canvas>
    <script>
      const ctx = document.getElementById('visitorChart').getContext('2d');
      
      // Function to generate a random RGB color
      const getRandomColor = () => {
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        return \`rgba(\${r}, \${g}, \${b}, 0.2)\`;
      };
      
      const dates = ${JSON.stringify(dates)};
      const visitorCounts = ${JSON.stringify(visitorCounts)};
      
      // Create an array to store random colors for each bar
      const backgroundColors = dates.map(() => getRandomColor());
      
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: dates,
          datasets: [{
            label: 'Total Visitors',
            data: visitorCounts,
            backgroundColor: backgroundColors, // Assign random colors
            borderColor: backgroundColors,
            borderWidth: 2,
          }],
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
            },
          },
        },
      });
    </script>
  </body>
</html>
`;

// Send the HTML page as a response
res.send(chartHtml);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not generate chart' });
  }
});

app.get('/visitor-left/:visitorID', async (req, res) => {
  try {
    const { visitorID } = req.params;

    // Find the visitor by visitorID
    const visitor = await Visitor.findOne({ visitorID });

    if (!visitor) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    // Get the current date and time for the visitor leaving in the desired time zone
    const tz = 'Asia/Kolkata'; // Replace 'YourTimeZone' with the desired time zone, e.g., 'Asia/Kolkata'
    const currentDate = moment.tz(tz);
    const leaveTime = currentDate.format('hh:mm A');

    // Update the visitor's leave time in the visitor document
    visitor.leaveTime = leaveTime;

    // Save the updated visitor document in the visitors collection
    await visitor.save();

    res.status(200).json({ message: 'Visitor left successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record visitor leave time' });
  }
});

//Total-Visitor-Count of PRESENT DATE
app.get('/total-visitors-in-today', async (req, res) => {
  try {
    // Get the current date in the desired time zone
    const tz = 'Asia/Kolkata'; // Replace with your desired time zone
    const currentDate = moment.tz(tz);

    // Format the current date in "YYYY-MM-DD" format
    const todayDate = currentDate.format('YYYY-MM-DD');

    // Use MongoDB aggregation to count visitors for today
    const totalVisitors = await Visitor.countDocuments({ visitDate: todayDate });

    res.status(200).json({ totalVisitors });
  } catch (error) {
    res.status(500).json({ error: 'Failed to count total visitors for today' });
  }
});

// Total-Visitor-Count OUT on PRESENT DATE
app.get('/total-visitors-out-today', async (req, res) => {
  try {
    // Get the current date in the desired time zone
    const tz = 'Asia/Kolkata'; // Replace with your desired time zone
    const currentDate = moment.tz(tz);

    // Format the current date in "YYYY-MM-DD" format
    const todayDate = currentDate.format('YYYY-MM-DD');

    // Use MongoDB aggregation to count visitors with leaveTime on today's date
    const totalVisitors = await Visitor.countDocuments({
      visitDate: todayDate,
      // Check if leaveTime exists and if it starts with today's date
      leaveTime: { $exists: true }
    });
    console.log(totalVisitors) ;

    res.status(200).json({ totalVisitors });
  } catch (error) {
    res.status(500).json({ error: 'Failed to count total visitors OUT for today' });
  }
});


// Total-Visitor-Count by Purpose for PRESENT DAY
app.get('/pieVchart', async (req, res) => {
  try {
    // Get the current date in the desired time zone
    const tz = 'Asia/Kolkata'; // Replace with your desired time zone
    const currentDate = moment.tz(tz);

    // Format the current date in "YYYY-MM-DD" format
    const todayDate = currentDate.format('YYYY-MM-DD');

    // Use MongoDB aggregation to group visitors by purpose and count them for today
    const purposeCounts = await Visitor.aggregate([
      {
        $match: {
          visitDate: todayDate,
        },
      },
      {
        $group: {
          _id: '$purpose',
          count: { $sum: 1 },
        },
      },
    ]);

    // Extract the purpose labels and counts
    const purposeLabels = purposeCounts.map((item) => item._id);
    const purposeData = purposeCounts.map((item) => item.count);

    // Generate a simple HTML page with the pie chart
    const chartHtml = `
      <html>
        <head>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        </head>
        <body>
          <canvas id="purposeChart" width="400" height="200"></canvas>
          <script>
            const ctx = document.getElementById('purposeChart').getContext('2d');

            // Function to generate a random RGB color
            const getRandomColor = () => {
              const r = Math.floor(Math.random() * 256);
              const g = Math.floor(Math.random() * 256);
              const b = Math.floor(Math.random() * 256);
              return \`rgba(\${r}, \${g}, \${b}, 0.5)\`;
            };

            const purposeLabels = ${JSON.stringify(purposeLabels)};
            const purposeData = ${JSON.stringify(purposeData)};

            // Create an array to store random colors for each pie slice
            const backgroundColors = purposeLabels.map(() => getRandomColor());

            new Chart(ctx, {
              type: 'pie',
              data: {
                labels: purposeLabels,
                datasets: [
                  {
                    data: purposeData,
                    backgroundColor: backgroundColors, // Assign random colors
                  },
                ],
              },
            });
          </script>
        </body>
      </html>
    `;

    // Send the HTML page as a response
    res.send(chartHtml);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not generate pie chart' });
  }
});

// BUS LOCATION UPDATE
const busSchema = new mongoose.Schema({
  name: String,
  latitude: Number,
  longitude: Number,
  driver: {
    name: String,
    contactNumber: String,
    busRoute: String,
    pin: String, // 6-digit pin
  },
});

const Bus = mongoose.model('Bus', busSchema);

// Route to add driver details to a bus
app.post('/add-driver/:busName', async (req, res) => {
  try {
    const { busId } = req.params;
    const { name, contactNumber, busRoute, pin } = req.body;

    // Find the bus by ID
    // const bus = await Bus.findById(busId);
    const bus = await Bus.findOne({ busId });

    if (!bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }

    // Update driver details
    bus.driver = {
      name,
      contactNumber,
      busRoute,
      pin,
    };

    // Save the updated bus document
    await bus.save();

    res.status(200).json({ message: 'Driver details added successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add driver details' });
  }
});


// Route for driver login
app.post('/driver-login', async (req, res) => {
  try {
    const { contactNumber, pin } = req.body;

    // Find the bus with matching driver contact number and pin
    const bus = await Bus.findOne({
      'driver.contactNumber': contactNumber,
      'driver.pin': pin,
    });

    if (!bus) {
      return res.status(401).json({ error: 'Login failed. Invalid credentials' });
    }

    // If the driver is found, return the bus name in the response
    res.status(200).json({ busName: bus.name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed. Internal server error' });
  }
});


// API endpoint to receive and update bus location
app.post('/update-location', async (req, res) => {
  const { name, latitude, longitude } = req.body;

  try {
    // Find the bus by name
    const existingBus = await Bus.findOne({ name });

    if (existingBus) {
      // Update the existing bus's location
      existingBus.latitude = latitude;
      existingBus.longitude = longitude;
      await existingBus.save();
    } else {
      // Create a new bus entry if it doesn't exist
      const newBus = new Bus({ name, latitude, longitude });
      await newBus.save();
    }

    res.status(200).json({ message: 'Location updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create an HTTP server
const server = http.createServer(app);

// Create a WebSocket server attached to the HTTP server
const io = socketIo(server);

// Real-time location updates using WebSocket
io.on('connection', (socket) => {
  console.log('A client connected');

  // Emit location updates to connected clients every second
  setInterval(async () => {
    try {
      // Fetch all bus locations from the database
      const busLocations = await Bus.find({}, 'name latitude longitude');

      // Send the bus locations to connected clients
      socket.emit('location-update', busLocations);
    } catch (error) {
      console.error(error);
    }
  }, 1000);

  socket.on('disconnect', () => {
    console.log('A client disconnected');
  });
});


// Define a route to get the latitude and longitude of a bus by its name
app.get('/bus-location/:name', async (req, res) => {
  const { name } = req.params;

  try {
    // Find the bus by name and select only the latitude and longitude fields
    const bus = await Bus.findOne({ name }, 'latitude longitude');

    if (!bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }

    res.json(bus);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Define a route to list the names of all buses
app.get('/list-buses', async (req, res) => {
  try {
    // Find all buses and return their names
    const buses = await Bus.find({}, 'name');

    if (!buses) {
      return res.status(404).json({ error: 'No buses found' });
    }

    // Extract the names from the buses and create an array
    const busNames = buses.map((bus) => bus.name);

    res.json(busNames);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/update-attendance', async (req, res) => {
  try {
    const { loginID, date, isPresent } = req.body;

    if (!loginID || !date || isPresent === undefined) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    const student = await Student.findOne({ loginID });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (isPresent) {
      student.presentDates.push(new Date(date));
    } else {
      student.absentDates.push(new Date(date));
    }

    await student.save();

    res.status(200).json({ message: 'Attendance updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update attendance' });
  }
});



// Define a route to edit a student by loginID
app.put('/edit-student/:loginID', async (req, res) => {
  try {
    const loginID = req.params.loginID; // Get the loginID from the URL parameters
    const updatedStudentData = req.body; // Get the updated student data from the request body

    // Find the student by their loginID and update their information
    const updatedStudent = await Student.findOneAndUpdate({ loginID }, updatedStudentData, {
      new: true, // Return the updated student data
      runValidators: true, // Validate the updated data against the schema
    });

    if (!updatedStudent) {
      // If the student with the given loginID is not found, return a 404 response
      return res.status(404).json({ error: 'Student not found' });
    }

    // Return the updated student data as a response
    res.status(200).json(updatedStudent);
  } catch (error) {
    // Handle errors and send an appropriate response
    console.error(error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});



// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// {
//     type: String,
//     validate: {
//       validator: function (v) {
//         return /^\d{11}$/.test(v); // Validate contactNumber format (10 digits)
//       },
//       message: 'Contact number must be 10 digits long.',
//     },
//   }

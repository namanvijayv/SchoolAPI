const cors = require("cors");
const fs = require("fs");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path"); // Import the 'path' module
const { Chart } = require("chart.js");
const moment = require("moment-timezone");
const http = require("http");
const socketIo = require("socket.io");

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
  presentDates: [String],
  absentDates: [String],
  notifications: [
    {
      date: String,   // Date of the event in "DD-MM-YYYY" format
      time: String,   // Time of the event
      reason: String, // Reason for the event
    }],
    announcement: [
    {
      date: String,   // Date of the event in "DD-MM-YYYY" format
      reason: String, // Reason for the event
    },
  ],
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
    res.status(200).json(student);
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
app.get("/get-student/loginID/:loginID", async (req, res) => {
  try {
    const loginID = req.params.loginID;

    // Find the student by loginID
    const student = await Student.findOne({ loginID: loginID });

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.status(200).json(student);
  } catch (error) {
    res.status(500).json({ error: "Could not fetch student" });
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
    res
      .status(200)
      .json({ message: "Login successful", loginID: student.loginID });
  } catch (error) {
    res.status(500).json({ error: "Login failed. Internal server error." });
  }
});

app.get("/get-classes-with-loginids", async (req, res) => {
  try {
    // Get a list of all distinct classes
    const classes = await Student.distinct("class");

    if (classes.length === 0) {
      // If no classes are found, return an empty list
      return res.status(200).json([]);
    }

    // Create an array to store class information with loginIDs
    const classInfoWithLoginIDs = [];

    // Iterate through each class and retrieve students' loginIDs
    for (const className of classes) {
      const studentsInClass = await Student.find(
        { class: className },
        "loginID"
      );

      // Extract the loginIDs from the result
      const loginIDs = studentsInClass.map((student) => student.loginID);

      // Add class information with loginIDs to the array
      classInfoWithLoginIDs.push({ class: className, loginIDs });
    }

    // Return the list of classes with loginIDs
    res.status(200).json(classInfoWithLoginIDs);
  } catch (error) {
    // Handle errors and send an appropriate response
    console.error(error);
    res.status(500).json({ error: "Could not fetch classes and loginIDs" });
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
app.post("/visitors", async (req, res) => {
  try {
    const { name, purpose, toWho, mobile } = req.body;

    // Generate a random 6-digit numeric ID for the visitor
    const visitorID = Math.floor(100000 + Math.random() * 900000).toString();

    // Get the current date and time in your desired time zone
    const currentDate = moment.tz("Asia/Kolkata"); // Replace 'YourTimeZone' with the desired time zone, e.g., 'Asia/Kolkata'
    const visitDate = currentDate.format("YYYY-MM-DD"); // Get date in "YYYY-MM-DD" format
    const visitTime = currentDate.format("hh:mm A"); // Get time in "hh:mm AM/PM" format

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
    res.status(200).json({ result: "Entry Successful" });
  } catch (error) {
    res.status(500).json({ error: "Could not save visitor" });
    console.log(error);
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
app.get("/total-visitors-per-day", async (req, res) => {
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
    res.status(500).json({ error: "Could not generate chart" });
  }
});

app.get("/visitor-left/:visitorID", async (req, res) => {
  try {
    const { visitorID } = req.params;

    // Find the visitor by visitorID
    const visitor = await Visitor.findOne({ visitorID });

    if (!visitor) {
      return res.status(404).json({ error: "Visitor not found" });
    }

    // Get the current date and time for the visitor leaving in the desired time zone
    const tz = "Asia/Kolkata"; // Replace 'YourTimeZone' with the desired time zone, e.g., 'Asia/Kolkata'
    const currentDate = moment.tz(tz);
    const leaveTime = currentDate.format("hh:mm A");

    // Update the visitor's leave time in the visitor document
    visitor.leaveTime = leaveTime;

    // Save the updated visitor document in the visitors collection
    await visitor.save();

    res.status(200).json({ message: "Visitor left successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to record visitor leave time" });
  }
});

//Total-Visitor-Count of PRESENT DATE
app.get("/total-visitors-in-today", async (req, res) => {
  try {
    // Get the current date in the desired time zone
    const tz = "Asia/Kolkata"; // Replace with your desired time zone
    const currentDate = moment.tz(tz);

    // Format the current date in "YYYY-MM-DD" format
    const todayDate = currentDate.format("YYYY-MM-DD");

    // Use MongoDB aggregation to count visitors for today
    const totalVisitors = await Visitor.countDocuments({
      visitDate: todayDate,
    });

    res.status(200).json({ totalVisitors });
  } catch (error) {
    res.status(500).json({ error: "Failed to count total visitors for today" });
  }
});

// Total-Visitor-Count OUT on PRESENT DATE
app.get("/total-visitors-out-today", async (req, res) => {
  try {
    // Get the current date in the desired time zone
    const tz = "Asia/Kolkata"; // Replace with your desired time zone
    const currentDate = moment.tz(tz);

    // Format the current date in "YYYY-MM-DD" format
    const todayDate = currentDate.format("YYYY-MM-DD");

    // Use MongoDB aggregation to count visitors with leaveTime on today's date
    const totalVisitors = await Visitor.countDocuments({
      visitDate: todayDate,
      // Check if leaveTime exists and if it starts with today's date
      leaveTime: { $exists: true },
    });
    console.log(totalVisitors);

    res.status(200).json({ totalVisitors });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to count total visitors OUT for today" });
  }
});

// Total-Visitor-Count by Purpose for PRESENT DAY
app.get("/pieVchart", async (req, res) => {
  try {
    // Get the current date in the desired time zone
    const tz = "Asia/Kolkata"; // Replace with your desired time zone
    const currentDate = moment.tz(tz);

    // Format the current date in "YYYY-MM-DD" format
    const todayDate = currentDate.format("YYYY-MM-DD");

    // Use MongoDB aggregation to group visitors by purpose and count them for today
    const purposeCounts = await Visitor.aggregate([
      {
        $match: {
          visitDate: todayDate,
        },
      },
      {
        $group: {
          _id: "$purpose",
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
    res.status(500).json({ error: "Could not generate pie chart" });
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

const Bus = mongoose.model("Bus", busSchema);

// Route to add driver details to a bus
app.post("/add-driver/:busName", async (req, res) => {
  try {
    const { busId } = req.params;
    const { name, contactNumber, busRoute, pin } = req.body;

    // Find the bus by ID
    // const bus = await Bus.findById(busId);
    const bus = await Bus.findOne({ busId });

    if (!bus) {
      return res.status(404).json({ error: "Bus not found" });
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

    res.status(200).json({ message: "Driver details added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to add driver details" });
  }
});

// Route for driver login
app.post("/driver-login", async (req, res) => {
  try {
    const { contactNumber, pin } = req.body;

    // Find the bus with matching driver contact number and pin
    const bus = await Bus.findOne({
      "driver.contactNumber": contactNumber,
      "driver.pin": pin,
    });

    if (!bus) {
      return res
        .status(401)
        .json({ error: "Login failed. Invalid credentials" });
    }

    // If the driver is found, return the bus name in the response
    res.status(200).json({ busName: bus.name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed. Internal server error" });
  }
});

// API endpoint to receive and update bus location
app.post("/update-location", async (req, res) => {
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

    res.status(200).json({ message: "Location updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create an HTTP server
const server = http.createServer(app);

// Create a WebSocket server attached to the HTTP server
const io = socketIo(server);

// Real-time location updates using WebSocket
io.on("connection", (socket) => {
  console.log("A client connected");

  // Emit location updates to connected clients every second
  setInterval(async () => {
    try {
      // Fetch all bus locations from the database
      const busLocations = await Bus.find({}, "name latitude longitude");

      // Send the bus locations to connected clients
      socket.emit("location-update", busLocations);
    } catch (error) {
      console.error(error);
    }
  }, 1000);

  socket.on("disconnect", () => {
    console.log("A client disconnected");
  });
});

// Define a route to get the latitude and longitude of a bus by its name
app.get("/bus-location/:name", async (req, res) => {
  const { name } = req.params;

  try {
    // Find the bus by name and select only the latitude and longitude fields
    const bus = await Bus.findOne({ name }, "latitude longitude");

    if (!bus) {
      return res.status(404).json({ error: "Bus not found" });
    }

    res.json(bus);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Define a route to list the names of all buses
app.get("/list-buses", async (req, res) => {
  try {
    // Find all buses and return their names
    const buses = await Bus.find({}, "name");

    if (!buses) {
      return res.status(404).json({ error: "No buses found" });
    }

    // Extract the names from the buses and create an array
    const busNames = buses.map((bus) => bus.name);

    res.json(busNames);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/update-attendance", async (req, res) => {
  try {
    const { loginID, date, isPresent } = req.body;

    if (!loginID || !date || isPresent === undefined) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    const student = await Student.findOne({ loginID });

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    if (isPresent) {
      student.presentDates.push(new Date(date));
    } else {
      student.absentDates.push(new Date(date));
    }

    await student.save();

    res.status(200).json({ message: "Attendance updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update attendance" });
  }
});

// Define a route to edit a student by loginID
app.put("/edit-student/:loginID", async (req, res) => {
  try {
    const loginID = req.params.loginID; // Get the loginID from the URL parameters
    const updatedStudentData = req.body; // Get the updated student data from the request body

    // Find the student by their loginID and update their information
    const updatedStudent = await Student.findOneAndUpdate(
      { loginID },
      updatedStudentData,
      {
        new: true, // Return the updated student data
        runValidators: true, // Validate the updated data against the schema
      }
    );

    if (!updatedStudent) {
      // If the student with the given loginID is not found, return a 404 response
      return res.status(404).json({ error: "Student not found" });
    }

    // Return the updated student data as a response
    res.status(200).json(updatedStudent);
  } catch (error) {
    // Handle errors and send an appropriate response
    console.error(error);
    res.status(500).json({ error: "Failed to update student" });
  }
});


//===================Teachers Start=========================
const teacherSchema = new mongoose.Schema({
  name: String,
  mobile: String,
  maritalStatus: String,
  address: String,
  gender: String,
  religion: String,
  post: String,
  subject: String,
  joiningDate: Date,
  salary: Number,
  inTime: String,
  outTime: String,
  present: [
    {
      date: String,
      record: {
        punchInTime: String,
        punchOutTime: String,
        totalWorkHours: String,
      },
    },
  ],
  absent: [Date],
  loginID: String,
  password: String,
  leaveRequests: [
    {
      startDate: String, // Start date of the leave request
      endDate: String,   // End date of the leave request
      reason: String,  // Reason for leave
      status: String,  // Status of the leave request (e.g., 'pending', 'approved', 'rejected')
      type:String
    },
  ],
});

// Define a method to calculate and set the total work hours
teacherSchema.methods.calculateTotalWorkHours = function () {
  this.present.forEach((presence) => {
    const punchIn = new Date(`2023-09-30 ${presence.punchInTime}`);
    const punchOut = new Date(`2023-09-30 ${presence.punchOutTime}`);
    const timeDiffMs = punchOut - punchIn;
    const hours = Math.floor(timeDiffMs / 1000 / 60 / 60);
    const minutes = Math.floor((timeDiffMs / 1000 / 60) % 60);
    presence.totalWorkHours = `${hours} hours ${minutes} minutes`;
  });
};

const Teacher = mongoose.model("Teacher", teacherSchema);

// Route to add a teacher
app.post("/add-teacher", async (req, res) => {
  try {
    const {
      name,
      mobile,
      maritalStatus,
      address,
      gender,
      religion,
      post,
      subject,
      joiningDate,
      salary,
      inTime, // Ensure inTime and outTime are included in the request body
      outTime,
    } = req.body;

    // Log the values of inTime and outTime to debug
    console.log("inTime:", inTime);
    console.log("outTime:", outTime);

    // Generate a random 6-digit alphanumeric loginID
    const loginID = generateRandomLoginID();

    // Generate a random 6-digit password
    const password = generateRandomPassword();

    // Create a new teacher object with inTime and outTime included
    const teacher = new Teacher({
      name,
      mobile,
      maritalStatus,
      address,
      gender,
      religion,
      post,
      subject,
      joiningDate,
      salary,
      inTime,
      outTime,
      present: [],
      absent: [],
      loginID,
      password,
    });

    // Save the teacher to the database
    await teacher.save();

    res.status(200).json({ message: "Teacher added successfully", teacher });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not add teacher" });
  }
});

// Helper function to generate a random 6-digit alphanumeric string
function generateRandomLoginID() {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let loginID = "";
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    loginID += characters.charAt(randomIndex);
  }
  return loginID;
}

// Helper function to generate a random 6-digit numeric password
function generateRandomPassword() {
  const password = Math.floor(100000 + Math.random() * 900000).toString();
  return password;
}

// Import necessary modules and set up your Express app

// Add a route to get a teacher's details by login ID
app.get("/teachers/:loginID", async (req, res) => {
  try {
    const loginID = req.params.loginID; // Get the login ID from the request parameters

    // Retrieve the teacher record with the specified login ID from the database
    const teacher = await Teacher.findOne({ loginID: loginID });

    // Check if a teacher with the provided login ID exists
    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Send the teacher's details as a JSON response
    res.status(200).json(teacher);
  } catch (error) {
    // Handle any errors that occur during the database query
    res.status(500).json({ error: "Could not fetch teacher details" });
  }
});

app.get("/punch-in/:loginID", async (req, res) => {
  try {
    const loginID = req.params.loginID;

    // Get the current date in "YYYY-MM-DD" format
    const currentDate = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
    const currentTime = moment().tz("Asia/Kolkata").format("hh:mm:ss A");

    // Find the teacher by loginID
    const existingTeacher = await Teacher.findOne({ loginID });

    if (!existingTeacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Check if the teacher is marked as absent for the current date
    const isAbsent = existingTeacher.absent.includes(currentDate);

    if (isAbsent) {
      return res
        .status(400)
        .json({ error: "Punch in not allowed for absent teachers" });
    }

    // Check if there is already a punch-in entry for the current date
    const existingPunchIn = existingTeacher.present.find((presence) => {
      return (
        presence.date === currentDate && presence.record.punchOutTime === ""
      );
    });

    if (existingPunchIn) {
      return res
        .status(400)
        .json({ error: "Punch-in already recorded for today" });
    }

    // Check if there is a punch-in entry for today with a punch-out time
    const todayPunchIn = existingTeacher.present.find((presence) => {
      return (
        presence.date === currentDate && presence.record.punchOutTime !== ""
      );
    });

    if (todayPunchIn) {
      return res.status(400).json({
        error:
          "Punch-in cannot be recorded for today as punch-out is already recorded",
      });
    }

    // Create a new presence entry
    const newPresence = {
      date: currentDate,
      record: {
        punchInTime: currentTime,
        punchOutTime: "",
        totalWorkHours: "",
      },
    };

    // Add the new presence entry to the teacher's presence array
    existingTeacher.present.push(newPresence);

    // Save the updated teacher record
    await existingTeacher.save();

    res.status(200).json({
      message: "Punch-in recorded successfully",
      punchInDate: currentDate,
      punchInTime: currentTime,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/punch-out/:loginID", async (req, res) => {
  try {
    const loginID = req.params.loginID;

    // Get the current date in "YYYY-MM-DD" format
    const currentDate = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
    const currentTime = moment().tz("Asia/Kolkata").format("hh:mm:ss A");

    // Find the teacher by loginID
    const existingTeacher = await Teacher.findOne({ loginID });

    if (!existingTeacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Check if the teacher is marked as absent for the current date
    const isAbsent = existingTeacher.absent.includes(currentDate);

    if (isAbsent) {
      return res
        .status(400)
        .json({ error: "Punch out not allowed for absent teachers" });
    }

    // Check if there is already a punch-out entry for the current date
    const existingPunchOut = existingTeacher.present.find((presence) => {
      return (
        presence.date === currentDate && presence.record.punchOutTime !== ""
      );
    });

    if (existingPunchOut) {
      return res
        .status(400)
        .json({ error: "Punch-out already recorded for today" });
    }

    // Find the last punch-in entry for today
    const todayPunchIn = existingTeacher.present.find((presence) => {
      return (
        presence.date === currentDate && presence.record.punchOutTime === ""
      );
    });

    if (!todayPunchIn) {
      return res.status(400).json({
        error:
          "Punch-out cannot be recorded without a punch-in entry for today",
      });
    }

    // Update the punch-out time for the last punch-in entry
    todayPunchIn.record.punchOutTime = currentTime;

    // Calculate and set the total work hours
    const punchIn = moment(`2023-09-30 ${todayPunchIn.record.punchInTime}`);
    const punchOut = moment(`2023-09-30 ${todayPunchIn.record.punchOutTime}`);
    const duration = moment.duration(punchOut.diff(punchIn));
    todayPunchIn.record.totalWorkHours = `${Math.floor(
      duration.asHours()
    )} hours ${duration.minutes()} minutes`;

    // Save the updated teacher record
    await existingTeacher.save();

    res.status(200).json({
      message: "Punch-out recorded successfully",
      punchOutDate: currentDate,
      punchOutTime: currentTime,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// For marking a teacher as absent
app.get("/absent/:loginID", async (req, res) => {
  try {
    const loginID = req.params.loginID;

    // Get the current date in "YYYY-MM-DD" format
    const currentDate = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");

    // Find the teacher by loginID
    const existingTeacher = await Teacher.findOne({ loginID });

    if (!existingTeacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Check if the teacher is already marked as absent for the current date
    if (existingTeacher.absent.includes(currentDate)) {
      return res
        .status(400)
        .json({ error: "Teacher is already marked as absent for today" });
    }

    // Mark the teacher as absent for the current date
    existingTeacher.absent.push(currentDate);

    // Save the changes to the database
    await existingTeacher.save();

    res.status(200).json({
      message: "Teacher marked as absent for today",
      absentDate: currentDate,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//--------Bar-Chart For the WORK HOURS--------
app.get("/teacher-chart/:loginID", async (req, res) => {
  try {
    // Retrieve the loginID from the route parameters
    const { loginID } = req.params;

    // Fetch the teacher's data from MongoDB based on the provided loginID
    const teacher = await Teacher.findOne({ loginID });

    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Extract the relevant data for the chart
    const dates = teacher.present.map((presence) => presence.date);
    const totalWorkHours = teacher.present.map((presence) => {
      // Extract hours and minutes from the totalWorkHours string
      const match = presence.record.totalWorkHours.match(
        /(\d+) hours (\d+) minutes/
      );
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        // Convert to total hours and minutes
        return hours + minutes / 60;
      } else {
        return 0; // Handle invalid totalWorkHours format
      }
    });

    // Create a constant background color for the bars
    const backgroundColor = "rgba(75, 192, 192, 0.2)";

    // Generate the chart as HTML
    const chartHtml = `
      <html>
        <head>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        </head>
        <body>
          <canvas id="teacherChart" width="400" height="200"></canvas>
          <script>
            const ctx = document.getElementById('teacherChart').getContext('2d');
            const chartConfig = {
              type: 'bar',
              data: {
                labels: ${JSON.stringify(dates)},
                datasets: [{
                  label: 'Total Work Hours',
                  data: ${JSON.stringify(totalWorkHours)},
                  backgroundColor: '${backgroundColor}', // Use a constant background color
                  borderColor: '${backgroundColor}',
                  borderWidth: 1,
                }],
              },
              options: {
                scales: {
                  y: {
                    beginAtZero: false, // Adjust this to false
                    ticks: {
                      callback: function (value, index, values) {
                        // Format the y-axis labels as hours and minutes
                        const hours = Math.floor(value);
                        const minutes = Math.round((value - hours) * 60);
                        return hours + ' hr ' + minutes + ' min';
                      },
                    },
                  },
                },
                plugins: {
                  tooltip: {
                    callbacks: {
                      label: function (context) {
                        // Format the tooltip label as hours and minutes
                        const value = context.parsed.y;
                        const hours = Math.floor(value);
                        const minutes = Math.round((value - hours) * 60);
                        return hours + ' hr ' + minutes + ' min';
                      },
                    },
                  },
                },
              },
            };
            new Chart(ctx, chartConfig);
          </script>
        </body>
      </html>
    `;

    // Set the content type to HTML and send the chart as an HTML response
    res.setHeader("Content-Type", "text/html");
    res.status(200).send(chartHtml);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not generate chart" });
  }
});

//-------Pie-Chart for the Attendence---------
app.get("/teacher-status-chart/:loginID", async (req, res) => {
  try {
    // Retrieve the loginID from the route parameters
    const { loginID } = req.params;

    // Fetch the teacher's data from MongoDB based on the provided loginID
    const teacher = await Teacher.findOne({ loginID });

    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Count the number of present and absent entries for the teacher
    const presentCount = teacher.present.length;
    const absentCount = teacher.absent.length;

    // Generate the chart as HTML
    const chartHtml = `
      <html>
        <head>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        </head>
        <body>
          <canvas id="statusChart" width="400" height="200"></canvas>
          <script>
            const ctx = document.getElementById('statusChart').getContext('2d');
            const chartConfig = {
              type: 'pie',
              data: {
                labels: ['Present', 'Absent'],
                datasets: [{
                  data: [${presentCount}, ${absentCount}],
                  backgroundColor: ['green', 'red'],
                }],
              },
            };
            new Chart(ctx, chartConfig);
          </script>
        </body>
      </html>
    `;

    // Set the content type to HTML and send the chart as an HTML response
    res.setHeader("Content-Type", "text/html");
    res.status(200).send(chartHtml);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not generate chart" });
  }
});

app.post('/teacher-login', async (req, res) => {
  try {
    const { loginID, password } = req.body;

    // Search for a teacher with the provided loginID and password
    const teacher = await Teacher.findOne({ loginID, password });

    if (teacher) {
      // Teacher found, generate an authentication token if needed
      // You can use authentication libraries like JWT to create a token

      // Respond with a success message or token
      res.status(200).json({ message: 'Teacher logged in successfully' });
    } else {
      // Teacher not found or invalid credentials
      res.status(401).json({ error: 'Invalid login credentials' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

//--------Get Student of a class---------
app.get('/get-students/:class', async (req, res) => {
  try {
    const classInfo = req.params.class; // Assuming the parameter is formatted as "class-section"

    // Find students in the specified class and section
    const students = await Student.find({ class: classInfo });

    if (students.length === 0) {
      return res.status(404).json({ message: 'No students found in this class' });
    }

    // Extract loginID, name, and classInfo of each student
    const studentData = students.map(student => ({
      loginID: student.loginID,
      name: student.name,
      classInfo: student.class+"-"+student.section
    }));

    res.status(200).json(studentData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});


//--------Present and Absent-----------
// Route to mark a student as present with the current date in "DD-MM-YYYY" format
app.get('/mark-present/:loginID', async (req, res) => {
  try {
    const { loginID } = req.params;

    // Get the current date in "DD-MM-YYYY" format
    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).split('/').reverse().join('-');

    // Find the student by loginID
    const student = await Student.findOne({ loginID });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Add the current date to the presentDates array
    student.presentDates.push(currentDate);

    // Remove the current date from the absentDates array (if it exists)
    const dateIndex = student.absentDates.indexOf(currentDate);
    if (dateIndex !== -1) {
      student.absentDates.splice(dateIndex, 1);
    }

    // Save the updated student data
    await student.save();

    res.status(200).json({ message: 'Student marked as present', student });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to mark student as present' });
  }
});

// Route to mark a student as absent with the current date in "DD-MM-YYYY" format
app.get('/mark-student-absent/:loginID', async (req, res) => {
  try {
    const { loginID } = req.params;

    // Get the current date in "DD-MM-YYYY" format
    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).split('/').reverse().join('-');

    // Find the student by loginID
    const student = await Student.findOne({ loginID });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Add the current date to the absentDates array
    student.absentDates.push(currentDate);

    // Remove the current date from the presentDates array (if it exists)
    const dateIndex = student.presentDates.indexOf(currentDate);
    if (dateIndex !== -1) {
      student.presentDates.splice(dateIndex, 1);
    }

    // Save the updated student data
    await student.save();

    res.status(200).json({ message: 'Student marked as absent', student });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to mark student as absent' });
  }
});



// LEAVE Request
// POST route to submit a leave request
app.post('/submit-leave-request/:loginID', async (req, res) => {
  try {
    const { loginID } = req.params;
    const { startDate, endDate, reason } = req.body;

    // Find the teacher based on their loginID
    const teacher = await Teacher.findOne({ loginID });

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    // Create a new leave request
    const leaveRequest = {
      startDate,
      endDate,
      reason,
      status: 'pending',
      type,
    };

    // Add the leave request to the teacher's leaveRequests array
    teacher.leaveRequests.push(leaveRequest);

    // Save the updated teacher document
    await teacher.save();

    res.status(200).json({ message: 'Leave request submitted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit leave request' });
  }
});

// GET route to retrieve leave requests for a teacher
app.get('/leave-requests/:loginID', async (req, res) => {
  try {
    const { loginID } = req.params;

    // Find the teacher based on their loginID
    const teacher = await Teacher.findOne({ loginID });

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    // Get the leave requests for the teacher
    const leaveRequests = teacher.leaveRequests;

    res.status(200).json(leaveRequests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

// PUT route to update the status of a leave request
app.put('/leave-request/:loginID/:requestID', async (req, res) => {
  try {
    const { loginID, requestID } = req.params;
    const { status } = req.body;

    // Find the teacher based on their loginID
    const teacher = await Teacher.findOne({ loginID });

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    // Find the leave request by its ID
    const leaveRequest = teacher.leaveRequests.id(requestID);

    if (!leaveRequest) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    // Update the status of the leave request
    leaveRequest.status = status;

    // Save the updated teacher document
    await teacher.save();

    res.status(200).json({ message: 'Leave request status updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update leave request status' });
  }
});


//Notifications By teacher and visible to students
app.post('/create-notification/:class/:section', async (req, res) => {
  try {
    const { class: section } = req.params;
    const { date, time, reason } = req.body;

    // Construct the event data
    const eventData = {
      date: date,   // Format the date as needed
      time: time,   // Format the time as needed
      reason: reason,
    };

    // Find students in the specified class and section
    const students = await Student.find({ class: section });

    if (students.length === 0) {
      return res.status(404).json({ message: 'No students found in this class and section' });
    }

    // Add the notification to each student's notifications array
    students.forEach(async (student) => {
      student.notifications.push(eventData);
      await student.save();
    });

    res.status(200).json({ message: 'Notification created and sent to students' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create and send notifications' });
  }
});


// Route for monthly and yearky attendence
function getSundaysInMonth(year, month) {
  const firstDay = moment.tz([year, month - 1, 1], 'Asia/Kolkata');
  const lastDay = moment.tz([year, month - 1, 1], 'Asia/Kolkata').endOf('month');

  let sundays = 0;
  while (firstDay.isSameOrBefore(lastDay)) {
    if (firstDay.day() === 0) {
      sundays++;
    }
    firstDay.add(1, 'day');
  }
  return sundays;
}

function getDaysInMonth(year, month) {
  const firstDay = moment.tz([year, month - 1, 1], 'Asia/Kolkata');
  const lastDay = moment.tz([year, month - 1, 1], 'Asia/Kolkata').endOf('month');
  return lastDay.diff(firstDay, 'days') + 1;
}


//Monthly
app.get('/monthly-attendance/:loginID/:year/:month', async (req, res) => {
  try {
    const { loginID, year, month } = req.params;

    // Find the teacher by loginID
    const teacher = await Teacher.findOne({ loginID });

    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Extract and calculate attendance data
    const totalDays = getDaysInMonth(year, month);
    const totalSundays = getSundaysInMonth(year, month);
    const workingDays = totalDays - totalSundays;
    const presentCount = teacher.present.filter((entry) => {
      const entryDate = moment(entry.date, 'YYYY-MM-DD');
      return entryDate.year() == year && entryDate.month() + 1 == month;
    }).length;

    const monthlyAttendance = {
      totalDays,
      workingDays,
      totalSundays,
      presentCount,
      year,
      month,
    };

    res.status(200).json(monthlyAttendance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch monthly attendance' });
  }
});

//Yearly
app.get('/yearly-attendance/:loginID/:year', async (req, res) => {
  try {
    const { loginID, year } = req.params;

    // Find the teacher by loginID
    const teacher = await Teacher.findOne({ loginID });

    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const totalYearlyAttendance = {
      year,
      totalDays: 0,
      workingDays: 0,
      totalSundays: 0,
      presentCount: 0,
    };

    for (let month = 1; month <= 12; month++) {
      const totalDays = getDaysInMonth(year, month);
      const workingDays = totalDays - getSundaysInMonth(year, month);
      const presentCount = teacher.present.filter((entry) => {
        const entryDate = moment(entry.date, 'YYYY-MM-DD');
        return entryDate.year() == year && entryDate.month() == month - 1;
      }).length;

      totalYearlyAttendance.totalDays += totalDays;
      totalYearlyAttendance.workingDays += workingDays;
      totalYearlyAttendance.totalSundays += getSundaysInMonth(year, month);
      totalYearlyAttendance.presentCount += presentCount;
    }

    res.status(200).json(totalYearlyAttendance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch yearly attendance' });
  }
});

// Import necessary modules and set up your Express app

// Add a route to get all teachers
app.get('/teachers', async (req, res) => {
  try {
    // Retrieve all teacher records from the database
    const teachers = await Teacher.find();
    
    // Send the list of teachers as a JSON response
    res.status(200).json(teachers);
  } catch (error) {
    // Handle any errors that occur during the database query
    res.status(500).json({ error: 'Could not fetch teachers' });
  }
});


//Notifications By teacher and visible to students
app.post('/create-announcement/:class/:section', async (req, res) => {
  try {
    const { class: section } = req.params;
    const { reason, date } = req.body;

    // Construct the event data
    const eventData = {
      reason: reason,
      date: date,   // Format the date as needed
    };

    // Find students in the specified class and section
    const students = await Student.find({ class: section });

    if (students.length === 0) {
      return res.status(404).json({ message: 'No students found in this class and section' });
    }

    // Add the notification to each student's notifications array
    students.forEach(async (student) => {
      student.announcement.push(eventData);
      await student.save();
    });

    res.status(200).json({ message: 'Announcement created and sent to students' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create and send notifications' });
  }
});


// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

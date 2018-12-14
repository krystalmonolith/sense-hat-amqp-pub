const imu = require("node-sense-hat").Imu;

const IMU = new imu.IMU();

IMU.getValue((err, data) => {
  if (err !== null) {
    console.error("Could not read sensor data: ", err);
    return;
  }

  console.log("Accelleration is: ", JSON.stringify(data.accel, null, "  "));
  console.log("Gyroscope is: ", JSON.stringify(data.gyro, null, "  "));
  console.log("Compass is: ", JSON.stringify(data.compass, null, "  "));
  console.log("Fusion data is: ", JSON.stringify(data.fusionPose, null, "  "));

  console.log("Temp is: ", data.temperature);
  console.log("Pressure is: ", data.pressure);
  console.log("Humidity is: ", data.humidity);
});


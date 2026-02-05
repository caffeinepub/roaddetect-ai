import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";
import Map "mo:core/Map";
import Text "mo:core/Text";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";

actor {
  include MixinStorage();

  type DetectionResult = {
    id : Text;
    image : Storage.ExternalBlob;
    processedImage : Storage.ExternalBlob;
    confidenceScore : Float;
    processingTime : Nat;
    timestamp : Time.Time;
    environmentalConditions : {
      lighting : Text;
      weather : Text;
      roadType : Text;
      surfaceType : Text;
    };
    metrics : {
      frameRate : Float;
      detectionQuality : Float;
      objectDetection : Text;
      systemPerformance : {
        hardwareType : Text;
        cpuUtilization : Float;
        gpuUtilization : Float;
        memoryUsage : Float;
      };
    };
  };

  type ObstacleEvent = {
    id : Text;
    position : {
      x : Float;
      y : Float;
    };
    type_ : Text;
    confidenceLevel : Float;
    timestamp : Time.Time;
    associatedDetectionId : Text;
    image : Storage.ExternalBlob;
    riskLevel : {
      level : Text;
      description : Text;
    };
  };

  type EmergencyEvent = {
    id : Text;
    type_ : Text;
    timestamp : Time.Time;
    associatedDetectionId : Text;
    description : Text;
    severity : {
      level : Text;
      urgency : Text;
    };
    resolutionStatus : Text;
  };

  type SpeedLimitDetection = {
    id : Text;
    detectedSpeedLimit : ?Nat;
    confidenceLevel : Float;
    timestamp : Time.Time;
    associatedDetectionId : Text;
    frameData : Storage.ExternalBlob;
  };

  type HardwarePerformanceMetrics = {
    hardwareType : Text;
    cpuUtilization : Float;
    gpuUtilization : Float;
    memoryUsage : Float;
    benchmarkScores : {
      cpuScore : Float;
      gpuScore : Float;
    };
    optimizationLevel : Text;
    processingEfficiency : Float;
  };

  type SpecificationReportRequest = {
    introduction : Text;
    features : Text;
    technicalDetails : Text;
    performance : Text;
    futurePlans : Text;
  };

  type SpecificationReportResponse = {
    id : Text;
    content : Storage.ExternalBlob;
    createdAt : Time.Time;
  };

  type CameraStatusRequest = { state : Text };
  type CameraStatusResponse = { message : Text };
  type VideoUploadRequest = { videoBlob : Storage.ExternalBlob };
  type VideoUploadResponse = { taskId : Text };
  type VideoProcessingStatusRequest = { taskId : Text };
  type VideoProcessingStatusResponse = {};

  module DetectionResult {
    public func compare(result1 : DetectionResult, result2 : DetectionResult) : Order.Order {
      Text.compare(result1.id, result2.id);
    };
  };

  module ObstacleEvent {
    public func compare(event1 : ObstacleEvent, event2 : ObstacleEvent) : Order.Order {
      Text.compare(event1.id, event2.id);
    };
  };

  let detectionHistory = Map.empty<Text, DetectionResult>();
  let obstacleEvents = Map.empty<Text, ObstacleEvent>();
  let emergencyEvents = Map.empty<Text, EmergencyEvent>();
  let speedLimitDetections = Map.empty<Text, SpeedLimitDetection>();
  let hardwarePerformanceMetrics = Map.empty<Text, HardwarePerformanceMetrics>();
  let specificationReports = Map.empty<Text, SpecificationReportResponse>();

  public shared ({ caller }) func storeDetectionResult(id : Text, image : Storage.ExternalBlob, processedImage : Storage.ExternalBlob, confidenceScore : Float, processingTime : Nat, timestamp : Time.Time, lighting : Text, weather : Text, roadType : Text, surfaceType : Text, frameRate : Float, detectionQuality : Float, objectDetection : Text, hardwareType : Text, cpuUtilization : Float, gpuUtilization : Float, memoryUsage : Float) : async () {
    let detectionResult : DetectionResult = {
      id;
      image;
      processedImage;
      confidenceScore;
      processingTime;
      timestamp;
      environmentalConditions = {
        lighting;
        weather;
        roadType;
        surfaceType;
      };
      metrics = {
        frameRate;
        detectionQuality;
        objectDetection;
        systemPerformance = {
          hardwareType;
          cpuUtilization;
          gpuUtilization;
          memoryUsage;
        };
      };
    };
    detectionHistory.add(id, detectionResult);
  };

  public shared ({ caller }) func storeObstacleEvent(id : Text, position : { x : Float; y : Float }, type_ : Text, confidenceLevel : Float, timestamp : Time.Time, associatedDetectionId : Text, image : Storage.ExternalBlob, riskLevel : { level : Text; description : Text }) : async () {
    let obstacleEvent : ObstacleEvent = {
      id;
      position;
      type_;
      confidenceLevel;
      timestamp;
      associatedDetectionId;
      image;
      riskLevel;
    };
    obstacleEvents.add(id, obstacleEvent);
  };

  public shared ({ caller }) func storeEmergencyEvent(id : Text, type_ : Text, timestamp : Time.Time, associatedDetectionId : Text, description : Text, severity : { level : Text; urgency : Text }, resolutionStatus : Text) : async () {
    let emergencyEvent : EmergencyEvent = {
      id;
      type_;
      timestamp;
      associatedDetectionId;
      description;
      severity;
      resolutionStatus;
    };
    emergencyEvents.add(id, emergencyEvent);
  };

  public shared ({ caller }) func storeSpeedLimitDetection(id : Text, detectedSpeedLimit : ?Nat, confidenceLevel : Float, timestamp : Time.Time, associatedDetectionId : Text, frameData : Storage.ExternalBlob) : async () {
    let speedLimitDetection : SpeedLimitDetection = {
      id;
      detectedSpeedLimit;
      confidenceLevel;
      timestamp;
      associatedDetectionId;
      frameData;
    };
    speedLimitDetections.add(id, speedLimitDetection);
  };

  public shared ({ caller }) func storeHardwarePerformanceMetrics(id : Text, hardwareType : Text, cpuUtilization : Float, gpuUtilization : Float, memoryUsage : Float, cpuScore : Float, gpuScore : Float, optimizationLevel : Text, processingEfficiency : Float) : async () {
    let metrics : HardwarePerformanceMetrics = {
      hardwareType;
      cpuUtilization;
      gpuUtilization;
      memoryUsage;
      benchmarkScores = {
        cpuScore;
        gpuScore;
      };
      optimizationLevel;
      processingEfficiency;
    };
    hardwarePerformanceMetrics.add(id, metrics);
  };

  public shared ({ caller }) func storeSpecificationReport(id : Text, content : Storage.ExternalBlob, createdAt : Time.Time) : async () {
    let report : SpecificationReportResponse = {
      id;
      content;
      createdAt;
    };
    specificationReports.add(id, report);
  };

  public query ({ caller }) func getAllDetectionResults() : async [DetectionResult] {
    detectionHistory.values().toArray().sort();
  };

  public query ({ caller }) func getAllObstacleEvents() : async [ObstacleEvent] {
    obstacleEvents.values().toArray().sort();
  };

  public query ({ caller }) func getAllEmergencyEvents() : async [EmergencyEvent] {
    emergencyEvents.values().toArray();
  };

  public query ({ caller }) func getAllSpeedLimitDetections() : async [SpeedLimitDetection] {
    speedLimitDetections.values().toArray();
  };

  public query ({ caller }) func getAllHardwarePerformanceMetrics() : async [HardwarePerformanceMetrics] {
    hardwarePerformanceMetrics.values().toArray();
  };

  public query ({ caller }) func getAllSpecificationReports() : async [SpecificationReportResponse] {
    specificationReports.values().toArray();
  };

  public query ({ caller }) func getDetectionResult(id : Text) : async DetectionResult {
    switch (detectionHistory.get(id)) {
      case (null) { Runtime.trap("Detection result not found") };
      case (?result) { result };
    };
  };

  public query ({ caller }) func getObstacleEvent(id : Text) : async ObstacleEvent {
    switch (obstacleEvents.get(id)) {
      case (null) { Runtime.trap("Obstacle event not found") };
      case (?event) { event };
    };
  };

  public query ({ caller }) func getEmergencyEvent(id : Text) : async EmergencyEvent {
    switch (emergencyEvents.get(id)) {
      case (null) { Runtime.trap("Emergency event not found") };
      case (?event) { event };
    };
  };

  public query ({ caller }) func getSpeedLimitDetection(id : Text) : async SpeedLimitDetection {
    switch (speedLimitDetections.get(id)) {
      case (null) { Runtime.trap("Speed limit detection not found") };
      case (?detection) { detection };
    };
  };

  public query ({ caller }) func getHardwarePerformanceMetrics(id : Text) : async HardwarePerformanceMetrics {
    switch (hardwarePerformanceMetrics.get(id)) {
      case (null) { Runtime.trap("Hardware performance metrics not found") };
      case (?metrics) { metrics };
    };
  };

  public query ({ caller }) func getSpecificationReport(id : Text) : async SpecificationReportResponse {
    switch (specificationReports.get(id)) {
      case (null) { Runtime.trap("Specification report not found") };
      case (?report) { report };
    };
  };

  public query ({ caller }) func getCombinedAlertHistory() : async {
    detectionResults : [DetectionResult];
    obstacleEvents : [ObstacleEvent];
    emergencyEvents : [EmergencyEvent];
    speedLimitDetections : [SpeedLimitDetection];
    hardwarePerformanceMetrics : [HardwarePerformanceMetrics];
  } {
    let detectionResults = detectionHistory.values().toArray().sort();
    let obstacleEventList = obstacleEvents.values().toArray().sort();
    let emergencyEventList = emergencyEvents.values().toArray();
    let speedLimitDetectionList = speedLimitDetections.values().toArray();
    let hardwarePerformanceMetricsList = hardwarePerformanceMetrics.values().toArray();

    {
      detectionResults;
      obstacleEvents = obstacleEventList;
      emergencyEvents = emergencyEventList;
      speedLimitDetections = speedLimitDetectionList;
      hardwarePerformanceMetrics = hardwarePerformanceMetricsList;
    };
  };

  public query ({ caller }) func getDetectionStatistics() : async {
    totalDetections : Nat;
    totalObstacleEvents : Nat;
    totalEmergencyEvents : Nat;
    averageConfidenceScore : Float;
    averageDetectionTime : Float;
    averageProcessingTime : Float;
    highestRiskLevel : Text;
    totalHighRiskEvents : Nat;
    mostCommonObjectType : Text;
    totalSpeedLimitDetections : Nat;
    averageSpeedLimitConfidence : Float;
    averageHardwareEfficiency : Float;
  } {
    let detectionResults = detectionHistory.values().toArray();
    let obstacleEventList = obstacleEvents.values().toArray();

    if (detectionResults.size() == 0 or obstacleEventList.size() == 0) {
      return {
        totalDetections = 0;
        totalObstacleEvents = 0;
        totalEmergencyEvents = 0;
        averageConfidenceScore = 0.0;
        averageDetectionTime = 0.0;
        averageProcessingTime = 0.0;
        highestRiskLevel = "Low";
        totalHighRiskEvents = 0;
        mostCommonObjectType = "None";
        totalSpeedLimitDetections = 0;
        averageSpeedLimitConfidence = 0.0;
        averageHardwareEfficiency = 0.0;
      };
    };

    let totalDetections = detectionResults.size();
    let totalObstacleEvents = obstacleEventList.size();
    let totalEmergencyEvents = emergencyEvents.values().toArray().size();

    let sumConfidenceScore = detectionResults.foldLeft(
      0.0,
      func(accum, result) {
        accum + result.confidenceScore;
      },
    );

    let sumDetectionTime = detectionResults.foldLeft(
      0.0,
      func(accum, result) {
        accum + result.processingTime.toFloat();
      },
    );

    let averageConfidenceScore = sumConfidenceScore / totalDetections.toFloat();
    let averageDetectionTime = sumDetectionTime / totalDetections.toFloat();

    var highestRiskLevel = "Low";

    let obstacleEventArray = obstacleEvents.values().toArray();
    obstacleEventArray.forEach(
      func(event) {
        switch (event.riskLevel.level) {
          case ("High") { highestRiskLevel := "High" };
          case ("Moderate") {
            if (highestRiskLevel != "High") {
              highestRiskLevel := "Moderate";
            };
          };
          case ("Low") {};
          case (_) {};
        };
      }
    );

    let totalHighRiskEvents = obstacleEvents.values().toArray().filter(
      func(event) {
        event.riskLevel.level == "High";
      }
    ).size();

    let objectTypeCounters = Map.empty<Text, Nat>();
    obstacleEvents.values().toArray().forEach(
      func(event) {
        switch (objectTypeCounters.get(event.type_)) {
          case (?count) {
            objectTypeCounters.add(event.type_, count + 1);
          };
          case (null) {
            objectTypeCounters.add(event.type_, 1);
          };
        };
      }
    );

    let eventTypes = objectTypeCounters.entries().toArray();
    let sortedTypes = eventTypes.sort(
      func(a, b) {
        if (a.1 > b.1) { return #less };
        if (a.1 < b.1) { return #greater };
        #equal;
      }
    );

    var mostCommonObjectType = "Unknown";
    if (sortedTypes.size() > 0) {
      mostCommonObjectType := sortedTypes[0].0;
    };

    let speedLimitDetectionArray = speedLimitDetections.values().toArray();
    let totalSpeedLimitDetections = speedLimitDetectionArray.size();
    let sumSpeedLimitConfidence = speedLimitDetectionArray.foldLeft(
      0.0,
      func(accum, detection) {
        accum + detection.confidenceLevel;
      },
    );
    let averageSpeedLimitConfidence = if (totalSpeedLimitDetections > 0) {
      sumSpeedLimitConfidence / totalSpeedLimitDetections.toFloat();
    } else { 0.0 };

    let hardwareMetricsArray = hardwarePerformanceMetrics.values().toArray();
    let totalMetrics = hardwareMetricsArray.size();
    let sumEfficiency = hardwareMetricsArray.foldLeft(
      0.0,
      func(accum, metric) {
        accum + metric.processingEfficiency;
      },
    );
    let averageHardwareEfficiency = if (totalMetrics > 0) {
      sumEfficiency / totalMetrics.toFloat();
    } else { 0.0 };

    let sumProcessingTime = detectionResults.foldLeft(
      0.0,
      func(accum, result) {
        accum + result.metrics.systemPerformance.cpuUtilization;
      },
    );
    let averageProcessingTime = sumProcessingTime / detectionResults.size().toFloat();

    {
      totalDetections;
      totalObstacleEvents;
      totalEmergencyEvents;
      averageConfidenceScore;
      averageDetectionTime;
      averageProcessingTime;
      highestRiskLevel;
      totalHighRiskEvents;
      mostCommonObjectType;
      totalSpeedLimitDetections;
      averageSpeedLimitConfidence;
      averageHardwareEfficiency;
    };
  };

  public query ({ caller }) func getEnvironmentalAnalysis() : async {
    detectionScoreByCondition : {
      lighting : Text;
      weather : Text;
      avgScore : Float;
      commonRoadType : Text;
      surfaceQuality : Text;
    };
  } {
    let detectionResults = detectionHistory.values().toArray();

    if (detectionResults.size() == 0) {
      Runtime.trap("No results available");
    };

    let mostCommonLightingCondition = if (detectionResults.size() > 0) {
      detectionResults[0].environmentalConditions.lighting;
    } else { "" };

    let sumScore = detectionResults.foldLeft(
      0.0,
      func(accum, result) {
        accum + result.confidenceScore;
      },
    );

    let avgScore = sumScore / detectionResults.size().toFloat();

    {
      detectionScoreByCondition = {
        lighting = mostCommonLightingCondition;
        weather = detectionResults[0].environmentalConditions.weather;
        avgScore;
        commonRoadType = detectionResults[0].environmentalConditions.roadType;
        surfaceQuality = detectionResults[0].environmentalConditions.surfaceType;
      };
    };
  };

  public query ({ caller }) func getFilteredEventHistory(filter : {
    objectType : ?Text;
    riskLevel : ?Text;
    severity : ?Text;
    detectionRange : ?Float;
  }) : async {
    obstacleEvents : [ObstacleEvent];
    emergencyEvents : [EmergencyEvent];
  } {
    let filteredObstacleEvents = obstacleEvents.values().toArray().sort().filter(
      func(event) {
        var matchesFilter = true;
        switch (filter.objectType) {
          case (?objectType) {
            matchesFilter := matchesFilter and event.type_ == objectType;
          };
          case (null) {};
        };
        switch (filter.riskLevel) {
          case (?riskLevel) {
            matchesFilter := matchesFilter and event.riskLevel.level == riskLevel;
          };
          case (null) {};
        };
        matchesFilter;
      }
    );
    let filteredEmergencyEvents = emergencyEvents.values().toArray().filter(
      func(event) {
        var matchesFilter = true;
        switch (filter.objectType) {
          case (?objectType) {
            matchesFilter := matchesFilter and event.type_ == objectType;
          };
          case (null) {};
        };
        switch (filter.severity) {
          case (?severity) {
            matchesFilter := matchesFilter and event.severity.level == severity;
          };
          case (null) {};
        };
        matchesFilter;
      }
    );
    {
      obstacleEvents = filteredObstacleEvents;
      emergencyEvents = filteredEmergencyEvents;
    };
  };

  public query ({ caller }) func getFilteredAlertHistory(filter : {
    objectType : ?Text;
    timeRange : ?{
      start : Time.Time;
      end : Time.Time;
    };
    riskLevel : ?Text;
    severity : ?Text;
    detectionRange : ?Float; // Not used?
    weatherCondition : ?Text;
    speedLimitRange : ?{
      lower : Nat;
      upper : Nat;
    };
  }) : async {
    detectionResults : [DetectionResult];
    obstacleEvents : [ObstacleEvent];
    emergencyEvents : [EmergencyEvent];
    speedLimitDetections : [SpeedLimitDetection];
  } {
    let detectionResults = detectionHistory.values().toArray().sort().filter(
      func(result) {
        var matchesFilter = true;
        switch (filter.objectType) {
          case (?objectType) {
            matchesFilter := matchesFilter and result.environmentalConditions.roadType == objectType;
          };
          case (null) {};
        };
        switch (filter.timeRange) {
          case (?timeRange) {
            matchesFilter := matchesFilter and (result.timestamp >= timeRange.start and result.timestamp <= timeRange.end);
          };
          case (null) {};
        };
        switch (filter.weatherCondition) {
          case (?weatherCondition) {
            matchesFilter := matchesFilter and result.environmentalConditions.weather == weatherCondition;
          };
          case (null) {};
        };
        matchesFilter;
      }
    );
    let obstacleEventList = obstacleEvents.values().toArray().sort().filter(
      func(event) {
        var matchesFilter = true;
        switch (filter.objectType) {
          case (?objectType) {
            matchesFilter := matchesFilter and event.type_ == objectType;
          };
          case (null) {};
        };
        switch (filter.timeRange) {
          case (?timeRange) {
            matchesFilter := matchesFilter and (event.timestamp >= timeRange.start and event.timestamp <= timeRange.end);
          };
          case (null) {};
        };
        switch (filter.riskLevel) {
          case (?riskLevel) {
            matchesFilter := matchesFilter and event.riskLevel.level == riskLevel;
          };
          case (null) {};
        };
        matchesFilter;
      }
    );
    let emergencyEventList = emergencyEvents.values().toArray().filter(
      func(event) {
        var matchesFilter = true;
        switch (filter.objectType) {
          case (?objectType) {
            matchesFilter := matchesFilter and event.type_ == objectType;
          };
          case (null) {};
        };
        switch (filter.timeRange) {
          case (?timeRange) {
            matchesFilter := matchesFilter and (event.timestamp >= timeRange.start and event.timestamp <= timeRange.end);
          };
          case (null) {};
        };
        switch (filter.severity) {
          case (?severity) {
            matchesFilter := matchesFilter and event.severity.level == severity;
          };
          case (null) {};
        };
        matchesFilter;
      }
    );
    let speedLimitDetectionArray = speedLimitDetections.values().toArray().filter(
      func(detection) {
        var matchesFilter = true;
        switch (filter.timeRange) {
          case (?timeRange) {
            matchesFilter := matchesFilter and (detection.timestamp >= timeRange.start and detection.timestamp <= timeRange.end);
          };
          case (null) {};
        };
        switch (filter.speedLimitRange) {
          case (?range) {
            switch (detection.detectedSpeedLimit) {
              case (?speed) {
                matchesFilter := matchesFilter and (speed >= range.lower and speed <= range.upper);
              };
              case (null) {};
            };
          };
          case (null) {};
        };
        matchesFilter;
      }
    );
    {
      detectionResults;
      obstacleEvents = obstacleEventList;
      emergencyEvents = emergencyEventList;
      speedLimitDetections = speedLimitDetectionArray;
    };
  };

  public shared ({ caller }) func updateCameraStatus(_ : CameraStatusRequest) : async CameraStatusResponse {
    { message = "Camera status updated successfully" };
  };

  public shared ({ caller }) func handleVideoUpload(_ : VideoUploadRequest) : async VideoUploadResponse {
    { taskId = "video_upload_task_id" };
  };

  public shared ({ caller }) func getVideoProcessingStatus(_ : VideoProcessingStatusRequest) : async VideoProcessingStatusResponse {
    {};
  };
};

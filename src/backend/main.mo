import Text "mo:core/Text";
import Map "mo:core/Map";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Order "mo:core/Order";
import Storage "blob-storage/Storage";
import MixinStorage "blob-storage/Mixin";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";
import Migration "migration";

(with migration = Migration.run)
actor {
  // Initialize the access control system
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  include MixinStorage();

  public type UserProfile = {
    name : Text;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

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
    roadSurfaceResults : {
      colorCorrectness : Float;
      perspectiveCorrectness : Float;
      surfaceTypeProbability : ?{
        wet : Float;
        dry : Float;
        icy : Float;
        snowy : Float;
        gravel : Float;
        muddy : Float;
        clean : Float;
      };
      potholeProbability : Float;
      crackProbability : Float;
      laneMarkProbability : Float;
      wornLaneMarkProbability : Float;
      offRoadProbability : Float;
      glareProbability : Float;
      nightDetectionProbability : Float;
      areaFeatures : {
        roadSurface : Float;
        sky : Float;
        surroundingEnvironment : Float;
      };
      colorSaturation : {
        road : Float;
        surrounding : Float;
      };
      colorHue : {
        road : Float;
      };
      brightnessLevels : {
        road : Float;
        lights : Float;
      };
      linearityFeatures : {
        possibleLanemarkings : Float;
        curvature : {
          left : Float;
          right : Float;
        };
        straightRoadProbability : Float;
      };
    };
  };

  let detectionHistory = Map.empty<Text, DetectionResult>();

  type Classification = {
    objectType : ObjectType;
    motion : MotionType;
  };

  type ObjectType = {
    #vehicle;
    #pedestrian;
    #debris;
    #unknown;
  };

  type MotionType = {
    #static;
    #moving;
  };

  module ObjectType {
    public func toText(objectType : ObjectType) : Text {
      switch (objectType) {
        case (#vehicle) { "vehicle" };
        case (#pedestrian) { "pedestrian" };
        case (#debris) { "debris" };
        case (#unknown) { "unknown" };
      };
    };
    public func fromText(text : Text) : ObjectType {
      switch (text) {
        case ("vehicle") { #vehicle };
        case ("pedestrian") { #pedestrian };
        case ("debris") { #debris };
        case (_) { #unknown };
      };
    };
  };

  module MotionType {
    public func toText(motion : MotionType) : Text {
      switch (motion) {
        case (#static) { "static" };
        case (#moving) { "moving" };
      };
    };
    public func fromText(text : Text) : MotionType {
      switch (text) {
        case ("static") { #static };
        case ("moving") { #moving };
        case (_) { #static };
      };
    };
  };

  type PotholeDetails = {
    size : Float;
    depth : Float;
    severity : Text;
    potholeType : PotholeType;
    location : {
      coordinates : (Float, Float);
      accuracy : Float;
    };
    image_url : Text;
    distance_from_vehicle : Float;
    createdAt : Time.Time;
  };

  type PotholeType = {
    #surface_cracks;
    #rough_size;
    #deep;
    #edge;
    #pavement;
    #complex;
    #unknown;
  };

  module PotholeType {
    public func toText(potholeType : PotholeType) : Text {
      switch (potholeType) {
        case (#surface_cracks) { "surface cracks" };
        case (#rough_size) { "rough size" };
        case (#deep) { "deep" };
        case (#edge) { "edge" };
        case (#pavement) { "pavement" };
        case (#complex) { "complex" };
        case (#unknown) { "unknown" };
      };
    };
    public func fromText(text : Text) : PotholeType {
      switch (text) {
        case ("surface cracks") { #deep };
        case ("rough size") { #rough_size };
        case ("deep") { #deep };
        case ("edge") { #edge };
        case ("pavement") { #pavement };
        case ("complex") { #complex };
        case (_) { #unknown };
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
    classification : Classification;
    potholeDetails : ?PotholeDetails;
  };

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

  let obstacleEvents = Map.empty<Text, ObstacleEvent>();

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

  type SpecificationReportResponse = {
    id : Text;
    content : Storage.ExternalBlob;
    createdAt : Time.Time;
  };

  let emergencyEvents = Map.empty<Text, EmergencyEvent>();
  let speedLimitDetections = Map.empty<Text, SpeedLimitDetection>();
  let hardwarePerformanceMetrics = Map.empty<Text, HardwarePerformanceMetrics>();
  let specificationReports = Map.empty<Text, SpecificationReportResponse>();

  public shared ({ caller }) func storeObstacleEvent(
    id : Text,
    position : { x : Float; y : Float },
    type_ : Text,
    confidenceLevel : Float,
    timestamp : Time.Time,
    associatedDetectionId : Text,
    image : Storage.ExternalBlob,
    riskLevel : { level : Text; description : Text },
    classification : Classification,
    potholeDetails : ?PotholeDetails,
  ) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can store obstacle events");
    };

    let obstacleEvent : ObstacleEvent = {
      id;
      position;
      type_;
      confidenceLevel;
      timestamp;
      associatedDetectionId;
      image;
      riskLevel;
      classification;
      potholeDetails;
    };
    obstacleEvents.add(id, obstacleEvent);
  };

  public query ({ caller }) func getAllObstacleEvents() : async [ObstacleEvent] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view obstacle events");
    };
    obstacleEvents.values().toArray().sort<ObstacleEvent>();
  };

  public query ({ caller }) func getObstacleEvent(id : Text) : async ObstacleEvent {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view obstacle events");
    };
    switch (obstacleEvents.get(id)) {
      case (null) { Runtime.trap("Obstacle event not found") };
      case (?event) { event };
    };
  };

  public shared ({ caller }) func addPotholeSpecificEvent(
    id : Text,
    position : { x : Float; y : Float },
    confidenceLevel : Float,
    timestamp : Time.Time,
    associatedDetectionId : Text,
    image : Storage.ExternalBlob,
    riskLevel : { level : Text; description : Text },
    potholeDetails : PotholeDetails,
  ) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add pothole events");
    };

    let classification : Classification = {
      objectType = #debris;
      motion = #static;
    };

    let obstacleEvent : ObstacleEvent = {
      id;
      position;
      type_ = "Pothole";
      confidenceLevel;
      timestamp;
      associatedDetectionId;
      image;
      riskLevel;
      classification;
      potholeDetails = ?potholeDetails;
    };
    obstacleEvents.add(id, obstacleEvent);
  };

  public query ({ caller }) func getAllPotholeEvents() : async [ObstacleEvent] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view pothole events");
    };
    let allEvents = obstacleEvents.values().toArray();
    allEvents.filter(func(e) { e.type_ == "Pothole" });
  };
};

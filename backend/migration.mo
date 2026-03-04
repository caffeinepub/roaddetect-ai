import Map "mo:core/Map";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Storage "blob-storage/Storage";
import Principal "mo:core/Principal";

module {
  type OldActor = {
    userProfiles : Map.Map<Principal, { name : Text }>;
    detectionHistory : Map.Map<Text, {
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
    }>;
    obstacleEvents : Map.Map<Text, {
      id : Text;
      position : { x : Float; y : Float };
      type_ : Text;
      confidenceLevel : Float;
      timestamp : Time.Time;
      associatedDetectionId : Text;
      image : Storage.ExternalBlob;
      riskLevel : { level : Text; description : Text };
      classification : {
        objectType : {
          #vehicle;
          #pedestrian;
          #debris;
          #unknown;
        };
        motion : {
          #static;
          #moving;
        };
      };
      potholeDetails : ?{
        size : Float;
        depth : Float;
        severity : Text;
        potholeType : {
          #surface_cracks;
          #rough_size;
          #deep;
          #edge;
          #pavement;
          #complex;
          #unknown;
        };
        location : { coordinates : (Float, Float); accuracy : Float };
        image_url : Text;
        distance_from_vehicle : Float;
        createdAt : Time.Time;
      };
    }>;
    emergencyEvents : Map.Map<Text, {
      id : Text;
      type_ : Text;
      timestamp : Time.Time;
      associatedDetectionId : Text;
      description : Text;
      severity : { level : Text; urgency : Text };
      resolutionStatus : Text;
    }>;
    speedLimitDetections : Map.Map<Text, {
      id : Text;
      detectedSpeedLimit : ?Nat;
      confidenceLevel : Float;
      timestamp : Time.Time;
      associatedDetectionId : Text;
      frameData : Storage.ExternalBlob;
    }>;
    hardwarePerformanceMetrics : Map.Map<Text, {
      hardwareType : Text;
      cpuUtilization : Float;
      gpuUtilization : Float;
      memoryUsage : Float;
      benchmarkScores : { cpuScore : Float; gpuScore : Float };
      optimizationLevel : Text;
      processingEfficiency : Float;
    }>;
    specificationReports : Map.Map<Text, {
      id : Text;
      content : Storage.ExternalBlob;
      createdAt : Time.Time;
    }>;
  };

  type NewActor = {
    userProfiles : Map.Map<Principal, { name : Text }>;
    detectionHistory : Map.Map<Text, {
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
    }>;
    obstacleEvents : Map.Map<Text, {
      id : Text;
      position : { x : Float; y : Float };
      type_ : Text;
      confidenceLevel : Float;
      timestamp : Time.Time;
      associatedDetectionId : Text;
      image : Storage.ExternalBlob;
      riskLevel : { level : Text; description : Text };
      classification : {
        objectType : {
          #vehicle;
          #pedestrian;
          #debris;
          #unknown;
        };
        motion : {
          #static;
          #moving;
        };
      };
      potholeDetails : ?{
        size : Float;
        depth : Float;
        severity : Text;
        potholeType : {
          #surface_cracks;
          #rough_size;
          #deep;
          #edge;
          #pavement;
          #complex;
          #unknown;
        };
        location : { coordinates : (Float, Float); accuracy : Float };
        image_url : Text;
        distance_from_vehicle : Float;
        createdAt : Time.Time;
      };
    }>;
    emergencyEvents : Map.Map<Text, {
      id : Text;
      type_ : Text;
      timestamp : Time.Time;
      associatedDetectionId : Text;
      description : Text;
      severity : { level : Text; urgency : Text };
      resolutionStatus : Text;
    }>;
    speedLimitDetections : Map.Map<Text, {
      id : Text;
      detectedSpeedLimit : ?Nat;
      confidenceLevel : Float;
      timestamp : Time.Time;
      associatedDetectionId : Text;
      frameData : Storage.ExternalBlob;
    }>;
    hardwarePerformanceMetrics : Map.Map<Text, {
      hardwareType : Text;
      cpuUtilization : Float;
      gpuUtilization : Float;
      memoryUsage : Float;
      benchmarkScores : { cpuScore : Float; gpuScore : Float };
      optimizationLevel : Text;
      processingEfficiency : Float;
    }>;
    specificationReports : Map.Map<Text, {
      id : Text;
      content : Storage.ExternalBlob;
      createdAt : Time.Time;
    }>;
    accidentRecords : Map.Map<Text, {
      id : Text;
      detectionMethod : { #manual; #aiAnalyzed };
      location : { latitude : Float; longitude : Float; accuracy : Float };
      timestamp : Time.Time;
      images : [Storage.ExternalBlob];
      description : Text;
      analysisResults : ?Text;
    }>;
  };

  public func run(old : OldActor) : NewActor {
    let accidentRecords = Map.empty<Text, {
      id : Text;
      detectionMethod : { #manual; #aiAnalyzed };
      location : { latitude : Float; longitude : Float; accuracy : Float };
      timestamp : Time.Time;
      images : [Storage.ExternalBlob];
      description : Text;
      analysisResults : ?Text;
    }>();
    { old with accidentRecords };
  };
};

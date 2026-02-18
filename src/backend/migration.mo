import Map "mo:core/Map";
import Text "mo:core/Text";
import Storage "blob-storage/Storage";

module {
  type OldClassification = {
    objectType : OldObjectType;
    motion : OldMotionType;
  };

  type OldObjectType = {
    #vehicle;
    #pedestrian;
    #debris;
    #unknown;
  };

  type OldMotionType = {
    #static;
    #moving;
  };

  type OldObstacleEvent = {
    id : Text;
    position : {
      x : Float;
      y : Float;
    };
    type_ : Text;
    confidenceLevel : Float;
    timestamp : Int;
    associatedDetectionId : Text;
    image : Storage.ExternalBlob;
    riskLevel : {
      level : Text;
      description : Text;
    };
    classification : OldClassification;
  };

  type OldActor = {
    obstacleEvents : Map.Map<Text, OldObstacleEvent>;
  };

  type NewActor = {
    obstacleEvents : Map.Map<Text, NewObstacleEvent>;
  };

  type NewObstacleEvent = {
    id : Text;
    position : {
      x : Float;
      y : Float;
    };
    type_ : Text;
    confidenceLevel : Float;
    timestamp : Int;
    associatedDetectionId : Text;
    image : Storage.ExternalBlob;
    riskLevel : {
      level : Text;
      description : Text;
    };
    classification : OldClassification;
    potholeDetails : ?PotholeDetails;
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
    createdAt : Int;
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

  public func run(old : OldActor) : NewActor {
    let newObstacleEvents = old.obstacleEvents.map<Text, OldObstacleEvent, NewObstacleEvent>(
      func(_id, oldEvent) {
        { oldEvent with potholeDetails = null };
      }
    );
    { obstacleEvents = newObstacleEvents };
  };
};

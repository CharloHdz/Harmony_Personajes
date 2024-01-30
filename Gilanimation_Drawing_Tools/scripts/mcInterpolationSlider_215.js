/*
 mcInterpolationSlider.js
 Version: 2.15
 Date (DD-MM-YYYY): 04/07/2019

 Description: The MasterController creation script.
              This script can be used after the interpolation slider data is saved to
              a .tbstate file.

 Copyright (C) 2019 Toon Boom Animation Inc.
 https://www.toonboom.com/legal/terms-and-conditions
*/
var stateLib = require(specialFolders.resource+"/scripts/utilities/state/TB_StateManager.js");
var interpolationCommonLib = require(specialFolders.resource+"/scripts/utilities/ui/TB_InterpolationCommonUtils.js");

function createSliderWidget()
{
  var valAttr = node.getAttr(Controller.node, frame.current(), "widget_val");

  var attr_slider_color       = node.getAttr(Controller.node, frame.current(), "slider_color");
  var attr_frame_color       = node.getAttr(Controller.node, frame.current(), "frame_color");
  var attr_widget_size        = node.getAttr(Controller.node, frame.current(), "widget_size");
  var attr_label_screen_space = node.getAttr(Controller.node, frame.current(), "label_screen_space");
  var attr_interpolate_poses  = node.getAttr(Controller.node, frame.current(), "interpolate_poses");
  var attr_horizontal         = node.getAttr(Controller.node, frame.current(), "horizontal");
  var attr_label              = node.getAttr(Controller.node, frame.current(), "label");
  var attr_label_font         = node.getAttr(Controller.node, frame.current(), "label_font");
  var attr_label_size         = node.getAttr(Controller.node, frame.current(), "label_size");
  var attr_label_color        = node.getAttr(Controller.node, frame.current(), "label_color");
  var attr_label_bg_color     = node.getAttr(Controller.node, frame.current(), "label_bg_color");
  var mcNameCapture = Controller.node;
  var mcSliderLen = 3.0;

  attr_frame_color.setUseSmallEditor(true);
  attr_slider_color.setUseSmallEditor(true);

  function createDynamicProperties() {
    var mcSize = attr_widget_size.doubleValue();
    return {
      horizontal:    attr_horizontal.boolValue(),
      steps:         ((attr_interpolate_poses.boolValue() == true) ? 0 : g_states.length),
      frame_color:    attr_frame_color.colorValue(),
      label_color:    attr_label_color.colorValue(),
      label_bg_color: attr_label_bg_color.colorValue(),
      label_font:     attr_label_font.textValue(),
      label_size:     attr_label_size.doubleValue(),
      label_pos:      attr_horizontal.boolValue() ? Point2d(mcSliderLen/2,mcSize*1.5) : Point2d(0,mcSliderLen+mcSize),
      label_screenspace: attr_label_screen_space.boolValue(),
      slider_color:   attr_slider_color.colorValue(),
      radius:         mcSize
    };
  }

  var initParameters = createDynamicProperties();

  //Add static properties
  initParameters.data = valAttr;
  initParameters.screen_space = false;
  initParameters.position = Point2d(0.,0.);
  initParameters.length = mcSliderLen;
  initParameters.label_justify = "Center";
  initParameters.slider_selection_color = ColorRGBA(150, 150, 255, 255);
  initParameters.frame_selection_color = ColorRGBA(200, 200, 255, 255);
  
  var val_label = attr_label.textValue();
  var sliderWidget = {};
  var dynamicLbl = {};
  var bHasDynamicLabel = (val_label.length > 0);
  
  //Conditionally add the dynamic label parameter
  if(bHasDynamicLabel)
  {
    initParameters.dynamic_label_data = "dynamicLabel";
    sliderWidget = new SliderWidget(initParameters);
    dynamicLbl = node.getAttr(Controller.node, frame.current(), "dynamicLabel");
    dynamicLbl.setValue(val_label);
  }
  else
  {
    sliderWidget = new SliderWidget(initParameters);
  }
  
  sliderWidget.valueChanged.connect( function(sliderVal)
  {
    if(node.getAttr(mcNameCapture,frame.current(), "invert").boolValue()==true)
      sliderVal = 100-sliderVal;
    
    var N_POSES = g_states.length;
    
    //The pose floating point index. fIndex = [0-N_POSES]
    var fIndex = (sliderVal/100)*(N_POSES-1);
    var ia = Math.floor(fIndex); //Lower index bound (integer)
    var ib = Math.ceil(fIndex);  //Upper index bound (integer)
    var a = (ib-fIndex); //The "inbetween" weight [0-1]
    var poseA = g_states[ia];
    var poseB = g_states[ib];
    var interpolatedPose = poseA.interpolate(1-a,poseB);
    
    if(bHasDynamicLabel)
      dynamicLbl.setValue(val_label+" : "+fIndex.toFixed(1));
    
    interpolatedPose.applyState(frame.current()); //Set values
    Action.performForEach("onActionInvalidateCanvas","cameraView");
  });

  //Update dynamic properties when a node change is triggered
  Controller.onNodeChanged = function () {
    sliderWidget.updateProperties(createDynamicProperties());
  };
  
  return sliderWidget;
}

function loadInterpolationStates(){
  var uiDataAttr = node.getAttr(Controller.node,frame.current(),"uiData");
  var uiData = JSON.parse(uiDataAttr.textValue());
  
  //example : uiData = {"poses":"/scripts/test1.tbState",
  //                    "location":"scn"}
  function onPreferredLocChanged(newLocation){
    uiData.location = newLocation;
    uiDataAttr.setValue(JSON.stringify(uiData));
  }
  
  function onStateFileLoaded(loadedStates){
    if(loadedStates.length>0)
      g_states = loadedStates;
  }
  
  interpolationCommonLib.loadMCStateFiles(Controller.node,
                                          stateLib,
                                          [uiData.poses],  //e.g. "/scripts/test1.tbState"
                                          uiData.location, //location key, e.g. "scn"
                                          onPreferredLocChanged,
                                          onStateFileLoaded);
}

//Controller.onFrameChanged = function()
//{
//}

Controller.onShowControl = function()
{
  MessageLog.trace("\n\n\n");
  MessageLog.trace(" ---------------------------------------------------------------------------");
  MessageLog.trace("| " + interpolationCommonLib.mcInterpolationSliderFile);
  MessageLog.trace(" ---------------------------------------------------------------------------");
  
  g_states = null;
  loadInterpolationStates();
  
  if(g_states==null)
  {
    MessageLog.trace(translator.tr("Failed to load data."));
    return;
  }
  
  g_widget = createSliderWidget();
  Controller.controls = [g_widget];
  MessageLog.trace(translator.tr("Done."));
}
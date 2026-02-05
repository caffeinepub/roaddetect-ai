import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { useActor } from '@/hooks/useActor';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function PDFReportGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const { actor, isFetching } = useActor();

  const { data: statistics } = useQuery({
    queryKey: ['detectionStatistics'],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getDetectionStatistics();
    },
    enabled: !!actor && !isFetching,
  });

  const generatePDFReport = async () => {
    setIsGenerating(true);
    try {
      const reportWindow = window.open('', '_blank');
      if (!reportWindow) {
        toast.error('Please allow pop-ups to generate the report');
        setIsGenerating(false);
        return;
      }

      const stats = statistics || {
        totalDetections: 0n,
        totalObstacleEvents: 0n,
        totalEmergencyEvents: 0n,
        averageConfidenceScore: 0,
        averageDetectionTime: 0,
        averageProcessingTime: 0,
        highestRiskLevel: 'Low',
        totalHighRiskEvents: 0n,
        mostCommonObjectType: 'None',
        totalSpeedLimitDetections: 0n,
        averageSpeedLimitConfidence: 0,
        averageHardwareEfficiency: 0,
      };

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Road Detection System Specification Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 40px 20px;
    }
    
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%);
      color: white;
      padding: 60px 40px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    
    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
      animation: pulse 4s ease-in-out infinite;
    }
    
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.5; }
      50% { transform: scale(1.1); opacity: 0.8; }
    }
    
    .header h1 {
      font-size: 42px;
      font-weight: 800;
      margin-bottom: 15px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
      position: relative;
      z-index: 1;
    }
    
    .header p {
      font-size: 18px;
      opacity: 0.95;
      position: relative;
      z-index: 1;
    }
    
    .content {
      padding: 50px 40px;
    }
    
    .section {
      margin-bottom: 50px;
      page-break-inside: avoid;
    }
    
    .section-header {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 25px;
      padding-bottom: 15px;
      border-bottom: 3px solid #0891b2;
    }
    
    .section-icon {
      width: 60px;
      height: 60px;
      border-radius: 15px;
      background: linear-gradient(135deg, #0891b2, #06b6d4);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 20px rgba(8, 145, 178, 0.3);
    }
    
    .section-icon img {
      width: 40px;
      height: 40px;
      object-fit: contain;
    }
    
    .section-title {
      font-size: 28px;
      font-weight: 700;
      color: #0891b2;
      flex: 1;
    }
    
    .section-content {
      font-size: 16px;
      color: #555;
      line-height: 1.8;
    }
    
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 25px;
      margin-top: 25px;
    }
    
    .feature-card {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border-radius: 15px;
      padding: 25px;
      border-left: 5px solid #0891b2;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
      transition: transform 0.3s ease;
    }
    
    .feature-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
    }
    
    .feature-icon {
      width: 50px;
      height: 50px;
      margin-bottom: 15px;
      background: white;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
    }
    
    .feature-icon img {
      width: 32px;
      height: 32px;
      object-fit: contain;
    }
    
    .feature-title {
      font-size: 18px;
      font-weight: 700;
      color: #0891b2;
      margin-bottom: 10px;
    }
    
    .feature-description {
      font-size: 14px;
      color: #666;
      line-height: 1.6;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 25px;
    }
    
    .stat-card {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
    }
    
    .stat-value {
      font-size: 32px;
      font-weight: 800;
      color: #0891b2;
      margin-bottom: 8px;
    }
    
    .stat-label {
      font-size: 14px;
      color: #666;
      font-weight: 600;
    }
    
    .highlight-box {
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
      border-radius: 15px;
      padding: 25px;
      margin: 25px 0;
      border-left: 5px solid #0891b2;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
    }
    
    .highlight-box h3 {
      color: #0891b2;
      font-size: 20px;
      margin-bottom: 15px;
      font-weight: 700;
    }
    
    .highlight-box ul {
      list-style: none;
      padding-left: 0;
    }
    
    .highlight-box li {
      padding: 10px 0;
      padding-left: 30px;
      position: relative;
      color: #555;
    }
    
    .highlight-box li::before {
      content: '✓';
      position: absolute;
      left: 0;
      color: #0891b2;
      font-weight: bold;
      font-size: 18px;
    }
    
    .hero-image {
      width: 100%;
      max-width: 800px;
      height: auto;
      border-radius: 15px;
      margin: 30px auto;
      display: block;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
    }
    
    .footer {
      background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
      color: white;
      padding: 40px;
      text-align: center;
      font-size: 14px;
    }
    
    .footer p {
      margin: 10px 0;
      opacity: 0.95;
    }
    
    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #0891b2, #06b6d4);
      color: white;
      border: none;
      padding: 15px 30px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 8px 20px rgba(8, 145, 178, 0.4);
      transition: all 0.3s ease;
      z-index: 1000;
    }
    
    .print-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 30px rgba(8, 145, 178, 0.5);
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .container {
        box-shadow: none;
        border-radius: 0;
      }
      
      .print-button {
        display: none;
      }
      
      .section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">🖨️ Print / Save as PDF</button>
  
  <div class="container">
    <div class="header">
      <h1>🚗 Road Detection System</h1>
      <p>Comprehensive Specification & Performance Report</p>
      <p style="margin-top: 10px; font-size: 14px; opacity: 0.8;">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    
    <div class="content">
      <!-- Introduction & Objective -->
      <div class="section">
        <div class="section-header">
          <div class="section-icon">
            <img src="/assets/generated/road-detection-hero.dim_800x600.png" alt="Introduction" />
          </div>
          <h2 class="section-title">📋 Introduction & Objective</h2>
        </div>
        <div class="section-content">
          <p>
            The <strong>Road Detection and Obstacle Alert System</strong> is an advanced machine learning-powered application 
            designed to operate in continuous live mode. It automatically accesses the system's camera for real-time road region 
            identification, obstacle detection, and speed limit monitoring with instant driver alerts.
          </p>
          <img src="/assets/generated/road-detection-hero.dim_800x600.png" alt="Road Detection Hero" class="hero-image" />
          <div class="highlight-box">
            <h3>🎯 Primary Objectives</h3>
            <ul>
              <li>Provide continuous real-time road monitoring and detection</li>
              <li>Deliver instant driver alerts for obstacles and speed limit violations</li>
              <li>Ensure comprehensive backend logging for safety analysis</li>
              <li>Optimize performance through desktop hardware acceleration</li>
              <li>Adapt to various environmental conditions (lighting, weather)</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Current Features & Implementation -->
      <div class="section">
        <div class="section-header">
          <div class="section-icon">
            <img src="/assets/generated/camera-icon-transparent.dim_200x200.png" alt="Features" />
          </div>
          <h2 class="section-title">✨ Current Features & Implementation</h2>
        </div>
        <div class="section-content">
          <p>
            The system implements a comprehensive suite of features designed for real-time road safety monitoring 
            and driver assistance. Each feature is optimized for performance and accuracy.
          </p>
          
          <div class="feature-grid">
            <div class="feature-card">
              <div class="feature-icon">
                <img src="/assets/generated/camera-icon-transparent.dim_200x200.png" alt="Live Camera" />
              </div>
              <div class="feature-title">📹 Live Operational Mode</div>
              <div class="feature-description">
                Automatic camera initialization with persistent live feed, continuous monitoring, 
                and automatic recovery if interrupted. Always-on operational status with minimal user intervention.
              </div>
            </div>
            
            <div class="feature-card">
              <div class="feature-icon">
                <img src="/assets/generated/obstacle-detection-icon-transparent.dim_200x200.png" alt="Obstacle Detection" />
              </div>
              <div class="feature-title">🚧 Obstacle Detection</div>
              <div class="feature-description">
                Real-time obstacle detection with color-coded risk levels (red for high-risk, yellow for minor). 
                Instant visual and audible alerts with position tracking and classification.
              </div>
            </div>
            
            <div class="feature-card">
              <div class="feature-icon">
                <img src="/assets/generated/speed-limit-icon-transparent.dim_200x200.png" alt="Speed Limit" />
              </div>
              <div class="feature-title">🚦 Speed Limit Detection</div>
              <div class="feature-description">
                Computer vision-based speed limit sign detection with automatic numeric value extraction. 
                Real-time enforcement with graduated alert intensity for violations.
              </div>
            </div>
            
            <div class="feature-card">
              <div class="feature-icon">
                <img src="/assets/generated/emergency-alert-icon-transparent.dim_64x64.png" alt="Emergency" />
              </div>
              <div class="feature-title">🚨 Emergency Reporting</div>
              <div class="feature-description">
                Continuous monitoring for danger conditions with detection of sudden obstacles or blocked roads. 
                Urgent emergency messages with alert prioritization based on threat level.
              </div>
            </div>
            
            <div class="feature-card">
              <div class="feature-icon">
                <img src="/assets/generated/weather-adaptation-icon-transparent.dim_300x200.png" alt="Weather" />
              </div>
              <div class="feature-title">🌦️ Environmental Adaptation</div>
              <div class="feature-description">
                ML-based image preprocessing for different lighting and weather conditions. 
                Dynamic parameter adjustment with rain streak normalization and fog contrast enhancement.
              </div>
            </div>
            
            <div class="feature-card">
              <div class="feature-icon">
                <img src="/assets/generated/upload-icon-transparent.dim_200x200.png" alt="Upload" />
              </div>
              <div class="feature-title">📤 Image Upload & Analysis</div>
              <div class="feature-description">
                Upload road images for detailed analysis with road segmentation, obstacle detection, 
                and speed limit recognition. Display results with confidence scores and metrics.
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Technical Components & Operation -->
      <div class="section">
        <div class="section-header">
          <div class="section-icon">
            <img src="/assets/generated/technical-components-icon-transparent.dim_200x200.png" alt="Technical" />
          </div>
          <h2 class="section-title">⚙️ Technical Components & Operation</h2>
        </div>
        <div class="section-content">
          <div class="highlight-box">
            <h3>🖥️ Frontend Processing</h3>
            <ul>
              <li>Automatic camera initialization and continuous live processing</li>
              <li>Native browser performance API integration for frame rate optimization</li>
              <li>Machine learning model execution in browser with environmental adaptation</li>
              <li>Desktop hardware-optimized processing pipeline with dynamic CPU/GPU utilization</li>
              <li>Speed limit sign detection and optical character recognition</li>
              <li>Web Workers implementation for background processing</li>
              <li>Hardware-accelerated processing with intelligent resource allocation</li>
              <li>Real-time obstacle detection with minimal latency</li>
              <li>Instant audio alert system integration</li>
            </ul>
          </div>
          
          <div class="highlight-box">
            <h3>💾 Backend Data Storage</h3>
            <ul>
              <li>Store user-uploaded images for analysis history</li>
              <li>Save detection results and associated metadata</li>
              <li>Comprehensive real-time logging of all detection events</li>
              <li>Obstacle detection events with position, type, and confidence</li>
              <li>Speed limit detection and violation event logging</li>
              <li>Emergency event logs with severity classification</li>
              <li>System performance logs with processing times and frame rates</li>
              <li>Hardware performance metrics and optimization data</li>
              <li>Alert effectiveness logs for safety system evaluation</li>
            </ul>
          </div>
          
          <div class="highlight-box">
            <h3>🚀 Desktop Hardware Optimization</h3>
            <ul>
              <li>Dynamic device capability detection and performance profiling</li>
              <li>Intelligent CPU and GPU resource allocation</li>
              <li>Adaptive ML pipeline scaling based on hardware resources</li>
              <li>Real-time performance monitoring with automatic parameter adjustment</li>
              <li>Hardware-accelerated image processing pipeline</li>
              <li>Dynamic quality vs performance balancing</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Performance Evaluation & Observations -->
      <div class="section">
        <div class="section-header">
          <div class="section-icon">
            <img src="/assets/generated/performance-chart-icon-transparent.dim_200x200.png" alt="Performance" />
          </div>
          <h2 class="section-title">📊 Performance Evaluation & Observations</h2>
        </div>
        <div class="section-content">
          <p>
            The system continuously monitors and logs performance metrics to ensure optimal operation 
            and identify areas for improvement. Below are the current system statistics:
          </p>
          
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${Number(stats.totalDetections)}</div>
              <div class="stat-label">Total Detections</div>
            </div>
            
            <div class="stat-card">
              <div class="stat-value">${Number(stats.totalObstacleEvents)}</div>
              <div class="stat-label">Obstacle Events</div>
            </div>
            
            <div class="stat-card">
              <div class="stat-value">${Number(stats.totalEmergencyEvents)}</div>
              <div class="stat-label">Emergency Events</div>
            </div>
            
            <div class="stat-card">
              <div class="stat-value">${(stats.averageConfidenceScore * 100).toFixed(1)}%</div>
              <div class="stat-label">Avg Confidence</div>
            </div>
            
            <div class="stat-card">
              <div class="stat-value">${stats.averageDetectionTime.toFixed(0)}ms</div>
              <div class="stat-label">Avg Detection Time</div>
            </div>
            
            <div class="stat-card">
              <div class="stat-value">${Number(stats.totalSpeedLimitDetections)}</div>
              <div class="stat-label">Speed Limit Detections</div>
            </div>
            
            <div class="stat-card">
              <div class="stat-value">${(stats.averageSpeedLimitConfidence * 100).toFixed(1)}%</div>
              <div class="stat-label">Speed Limit Confidence</div>
            </div>
            
            <div class="stat-card">
              <div class="stat-value">${(stats.averageHardwareEfficiency * 100).toFixed(1)}%</div>
              <div class="stat-label">Hardware Efficiency</div>
            </div>
          </div>
          
          <div class="highlight-box" style="margin-top: 30px;">
            <h3>🎯 Key Performance Indicators</h3>
            <ul>
              <li><strong>Highest Risk Level Detected:</strong> ${stats.highestRiskLevel}</li>
              <li><strong>Total High-Risk Events:</strong> ${Number(stats.totalHighRiskEvents)}</li>
              <li><strong>Most Common Object Type:</strong> ${stats.mostCommonObjectType}</li>
              <li><strong>Average Processing Time:</strong> ${stats.averageProcessingTime.toFixed(2)}ms</li>
            </ul>
          </div>
          
          <div class="highlight-box">
            <h3>📈 Performance Metrics Tracked</h3>
            <ul>
              <li>Real-time confidence scores for road, obstacle, and speed limit detection</li>
              <li>Processing time and frame rate for live video</li>
              <li>Accuracy indicators and detection quality metrics</li>
              <li>Environmental condition recognition status with ML-driven adjustments</li>
              <li>Hardware acceleration status and optimization feedback</li>
              <li>Obstacle detection latency metrics</li>
              <li>Desktop hardware utilization (CPU/GPU usage, memory consumption)</li>
              <li>Alert response time and driver acknowledgment tracking</li>
              <li>Live operational uptime and system reliability indicators</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Future Enhancements & Maintenance Plan -->
      <div class="section">
        <div class="section-header">
          <div class="section-icon">
            <img src="/assets/generated/future-enhancements-icon-transparent.dim_200x200.png" alt="Future" />
          </div>
          <h2 class="section-title">🔮 Future Enhancements & Maintenance Plan</h2>
        </div>
        <div class="section-content">
          <div class="highlight-box">
            <h3>🚀 Planned Enhancements</h3>
            <ul>
              <li><strong>Advanced ML Models:</strong> Integration of more sophisticated deep learning models for improved accuracy</li>
              <li><strong>Multi-Camera Support:</strong> Ability to process feeds from multiple cameras simultaneously</li>
              <li><strong>Lane Detection:</strong> Advanced lane keeping assistance with departure warnings</li>
              <li><strong>Traffic Sign Recognition:</strong> Expanded recognition of various traffic signs beyond speed limits</li>
              <li><strong>Pedestrian Detection:</strong> Real-time detection and tracking of pedestrians</li>
              <li><strong>Vehicle Classification:</strong> Identify and classify different types of vehicles</li>
              <li><strong>Night Vision Enhancement:</strong> Improved low-light and night-time detection capabilities</li>
              <li><strong>Cloud Integration:</strong> Optional cloud-based processing for enhanced performance</li>
              <li><strong>Mobile App:</strong> Native mobile applications for iOS and Android</li>
              <li><strong>Voice Alerts:</strong> Natural language voice notifications for hands-free operation</li>
            </ul>
          </div>
          
          <div class="highlight-box">
            <h3>🔧 Maintenance Plan</h3>
            <ul>
              <li><strong>Regular Model Updates:</strong> Quarterly updates to ML models with improved training data</li>
              <li><strong>Performance Optimization:</strong> Continuous monitoring and optimization of processing efficiency</li>
              <li><strong>Bug Fixes:</strong> Rapid response to reported issues with weekly patch releases</li>
              <li><strong>Security Updates:</strong> Regular security audits and vulnerability patches</li>
              <li><strong>Browser Compatibility:</strong> Testing and updates for latest browser versions</li>
              <li><strong>Hardware Support:</strong> Expanded support for new hardware acceleration technologies</li>
              <li><strong>User Feedback Integration:</strong> Monthly review and implementation of user suggestions</li>
              <li><strong>Documentation Updates:</strong> Continuous improvement of user guides and technical documentation</li>
            </ul>
          </div>
          
          <div class="highlight-box">
            <h3>📅 Roadmap Timeline</h3>
            <ul>
              <li><strong>Q1 2026:</strong> Advanced ML model integration and multi-camera support</li>
              <li><strong>Q2 2026:</strong> Lane detection and traffic sign recognition expansion</li>
              <li><strong>Q3 2026:</strong> Pedestrian detection and vehicle classification</li>
              <li><strong>Q4 2026:</strong> Mobile app launch and cloud integration</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <p><strong>Road Detection System Specification Report</strong></p>
      <p>© 2025 Built with ❤️ using caffeine.ai</p>
      <p>For more information, visit <a href="https://caffeine.ai" style="color: white; text-decoration: underline;">caffeine.ai</a></p>
      <p style="margin-top: 20px; font-size: 12px; opacity: 0.8;">
        This report is generated automatically and contains real-time system statistics and performance data.
      </p>
    </div>
  </div>
</body>
</html>
      `;

      reportWindow.document.write(htmlContent);
      reportWindow.document.close();
      
      toast.success('PDF report generated! Use Print to save as PDF.');
    } catch (error) {
      console.error('Error generating PDF report:', error);
      toast.error('Failed to generate PDF report');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={generatePDFReport}
      disabled={isGenerating}
      variant="outline"
      size="sm"
      className="gap-2 rounded-xl transition-all duration-300 hover:bg-primary/10 hover:shadow-glow-sm"
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <FileText className="h-4 w-4" />
          Generate Report
        </>
      )}
    </Button>
  );
}

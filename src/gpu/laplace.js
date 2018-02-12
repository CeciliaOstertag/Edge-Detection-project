/**
 * This function calculates the value of the Laplacian of Gaussian at a specific point in a matrix.
 * given the squaring of both x and y, the values of the Laplacian of Gaussian distribution
 * for (1,-1), (-1,1), (1,1) and (-1,-1) are the same, which gives the symmetrical aspect.
 *
 *
 * @param {integer} x - x value for which we want to calculate the Laplacian of Gaussian Function's output.
 * @param {integer} y - y value for which we want to calculate the Laplacian of Gaussian Function's output.
 * @param {double} sigma - Threshold chosen by user (affects the blurring impact of the gaussian kernel).
 * @return {double} - Laplacian of Gaussian Distribution value for given (x,y) pair and threshold value.
 *
 * @author peter bock
 */
const unitaryLoG = (x,y,sigma) => Math.exp(( -((x*x) + (y*y))/(2.0*sigma*sigma) ) ) * (-1/(Math.pow(sigma,4)*Math.PI)) * (1 - ((Math.pow(x,2) + Math.pow(y,2)) / (2*Math.pow(sigma,2))));


/**
 * Generates a kernel by using the given values. the generated kernel is centered around the middle, at coordinates (0,0).
 *
 * The chosen implementation closely follows the methodology laid out in this article:
 * @website https://softwarebydefault.com/2013/06/08/calculating-gaussian-kernels/
 *
 * @param {integer} kernelSize - The size of the 1D kernel to generate. This MUST be a non-even number !
 * @param {double} sigma - Threshold defined by user.

 * @return {array} - generated 2D kernel, stored in a 1D array.
 *
 * @author Peter Bock
 */



const kernelGenerator = (kernelSize,sigma,kernelFunction) =>
{

    let kernel = [];
    let kernelRadius = Math.floor(kernelSize/2);
    let val = 0;
    let counter = 0;

    for (let y = -kernelRadius; y <= kernelRadius; y++)
    {

		for(let x = -kernelRadius; x <= kernelRadius; x++)
		{
	    	val = kernelFunction(x,y,sigma);
	    	kernel[counter] = val;

	    	counter += 1;
		}
    }

    return kernel;
};




/**
 * Normalizes a given array
 *
 * @param {array} kernel - the array to normalize
 * @return {array} - normalized array.
 *
 * @author Peter Bock
 */
const normalize = (array) =>
{
	//TODO functionalize
    let z = 1.0 /array.reduce((sum,x) => sum+x ,0);
    let normalizedArray = array.map(x => x * z);

    return normalizedArray;
};



/**
 * This function calculates the Laplacian of Gaussian kernel, using the LoG unitary calculator and the normalize() function.
 *
 *
 * @param {int} kernelSize - size of the normalized Gaussian kernel to generate
 * @param {double} sigma - Threshold chosen by user (affects the blurring impact of the gaussian kernel).
 * @return {array} - Laplacian of Gaussian kernel
 *
 * @author peter bock
 */
const logKernel = (kernelSize,sigma) => normalize(kernelGenerator( kernelSize, sigma, unitaryLoG ));



const gpuEdgeLaplace = () => (raster, graphContext, copy_mode = true) => 
{

	let id='laplace'
	
	console.log(id)
	
// Vertex Shader
	let src_vs = `#version 300 es
  
    in vec2 a_vertex;
    in vec2 a_texCoord;

    uniform vec2 u_resolution;
    
    out vec2 v_texCoord;
    
    void main() {
      v_texCoord = a_texCoord;
      vec2 clipSpace = a_vertex * u_resolution * 2.0 - 1.0;
      gl_Position = vec4(clipSpace * vec2(1,-1), 0.0, 1.0);
    }
  `;


// 1. Laplacian  of Gaussian application
    
// Fragment Shader 
let src_fs_log = `#version 300 es
    // idem to Cecilia's work
    // I (peter bock) have no idea how to make heads or tails of this. so I just studied Cecilia's work till I could make out which part should be different for the LoG algorithm.
    // pretty much none of this is my work.
    precision mediump float;
    
    in vec2 v_texCoord;
    uniform sampler2D u_image;
    uniform float u_kernel_H[9];
    
    out vec4 outColor;
    
    void main(){
	
	float stepSizeX = 1.0 / float(textureSize(u_image,0).x);
	float stepSizeY = 1.0 / float(textureSize(u_image,0).y);
	
	//get the 9 neighboring pixel intensities
	float a11 = texture(u_image, v_texCoord - vec2(stepSizeX,stepSizeY)).r;
	float a12 = texture(u_image, vec2(v_texCoord.s, v_texCoord.t - stepSizeY)).r;
	float a13 = texture(u_image, vec2(v_texCoord.s + stepSizeX, v_texCoord.t - stepSizeY)).r;
	
	float a21 = texture(u_image, vec2(v_texCoord.s - stepSizeX, v_texCoord.t)).r;
		float a22 = texture(u_image, v_texCoord).r;
	float a23 = texture(u_image, vec2(v_texCoord.s + stepSizeX, v_texCoord.t)).r;
	
	float a31 = texture(u_image, vec2(v_texCoord.s - stepSizeX, v_texCoord.t + stepSizeY)).r;
	float a32 = texture(u_image, vec2(v_texCoord.s, v_texCoord.t + stepSizeX)).r;
	float a33 = texture(u_image, v_texCoord + vec2(stepSizeX,stepSizeY)).r;
	
	//gradient vector
	
	// this is where the results differ from Cecilia's work.
	// Given that the Laplacian kernel CANNOT be separated into Horizontal and Vertical aspects, it is necessary to calculate an entire kernel using the unitary LoG JS transposed into glsl.
	// This also makes the entire Blurring/Gaussian step in Cecilia's algorithm unnecessary, as LoG includes the Gaussian blur in it's kernel already.

	// not sure how to do this without the vec2, but since I'll only be using the X component I can just leave it as a vec2 anyway.
	
	float laplace = step(0.0,u_kernel_H[0] * a11 + u_kernel_H[1] * a12 + u_kernel_H[2] * a13 + u_kernel_H[3] * a21 + u_kernel_H[4] * a22 + u_kernel_H[5] * a23 + u_kernel_H[6] * a31 + u_kernel_H[7] * a32 + u_kernel_H[8] * a33);
	

	
	
	// I need to do a filtering step, and step(a,b) seems like it fits the bill.
	// I should be able to adjust the value in x according to the result step gives applied to it.

	
	outColor.r = laplace; 
	outColor.g = outColor.r;
	outColor.b = outColor.r; // utiliser les 3 canaux rend presque tout blanc X/
	outColor.a = 1.0;
	
    }`;
    
let shader_log = gpu.createProgram(graphContext,src_vs,src_fs_log);
  console.log('log filter done...');
 
   let gproc_log = gpu.createGPU(graphContext,raster.width,raster.height)
    .size(raster.width,raster.height)
    .geometry(gpu.rectangle(raster.width,raster.height))
    .attribute('a_vertex',2,'float', 16,0)      // X, Y
    .attribute('a_texCoord',2, 'float', 16, 8)  // S, T
    .texture(raster)
    .redirectTo('fbo1','float32',0)
    .packWith(shader_log) // VAO
    .clearCanvas([0.0,1.0,1.0,1.0])
    .preprocess()
    .uniform('u_resolution',new Float32Array([1.0/raster.width,1.0/raster.height]))
    .uniform('u_image',0)
    .uniform('u_kernel_H', new Float32Array([1,1,1,1,-8,1,1,1,1]))//logKernel(3,1)
    .run(); // ne plus rediriger, et eliminer les gprocs apres celui ci, rend un lena juste legerement floutée X/
    
let src_fs_threshold = `#version 300 es
  
    precision mediump float;
    
    in vec2 v_texCoord;
    uniform sampler2D u_image;
    
    out vec4 outColor;
    
    void main(){
		
		float stepSizeX = 1.0 / float(textureSize(u_image,0).x);
		float stepSizeY = 1.0 / float(textureSize(u_image,0).y);
	
		//get the 9 neighboring pixels values
		float a11 = texture(u_image, v_texCoord - vec2(stepSizeX,stepSizeY)).r;
		float a12 = texture(u_image, vec2(v_texCoord.s, v_texCoord.t - stepSizeY)).r;
		float a13 = texture(u_image, vec2(v_texCoord.s + stepSizeX, v_texCoord.t - stepSizeY)).r;
		
		float a21 = texture(u_image, vec2(v_texCoord.s - stepSizeX, v_texCoord.t)).r;
		float a22 = texture(u_image, v_texCoord).r;
		float a23 = texture(u_image, vec2(v_texCoord.s + stepSizeX, v_texCoord.t)).r;
		
		float a31 = texture(u_image, vec2(v_texCoord.s - stepSizeX, v_texCoord.t + stepSizeY)).r;
		float a32 = texture(u_image, vec2(v_texCoord.s, v_texCoord.t + stepSizeX)).r;
		float a33 = texture(u_image, v_texCoord + vec2(stepSizeX,stepSizeY)).r;
		
		if ((a22 == 0.0) && ( (a11 == 1.0) || (a12 == 1.0) || (a13 == 1.0) || (a21 == 1.0) || (a23 == 1.0) || (a31 == 1.0) || (a32 == 1.0) || (a33 == 1.0) ))
		{
			outColor.r = 1.0;
		}
		else
		{
			outColor.r = 0.0;
		}
		outColor.g = outColor.r;
		outColor.b = outColor.r;
		outColor.a = 1.0;
     
    }`;

let shader_threshold = gpu.createProgram(graphContext,src_vs,src_fs_threshold);  
    
    let gproc_threshold = gpu.createGPU(graphContext,raster.width,raster.height)
    .size(raster.width,raster.height)
    .geometry(gpu.rectangle(raster.width,raster.height))
    .attribute('a_vertex',2,'float', 16,0)      // X, Y
    .attribute('a_texCoord',2, 'float', 16, 8)  // S, T
    .texture(gproc_log.framebuffers['fbo1'])
    .redirectTo('fbo2','float32',0)
    .packWith(shader_threshold) // VAO
    .clearCanvas([0.0,1.0,1.0,1.0])
    .preprocess()
    .uniform('u_resolution',new Float32Array([1.0/raster.width,1.0/raster.height]))
    .uniform('u_image',0)
    .run(); 
    
    console.log('threshold done...'); 
    
let src_fs = `#version 300 es
  
    precision mediump float;
    
    in vec2 v_texCoord;
    uniform sampler2D u_image;
    
    out vec4 outColor;
    
    void main(){
      outColor = vec4(texture(u_image, v_texCoord).rgb, 1.0);
    }`;
    

///////////

let the_shader = gpu.createProgram(graphContext,src_vs,src_fs);
    
  // Step #2: Create a gpu.Processor, and define geometry, attributes, texture, VAO, .., and run
  let gproc = gpu.createGPU(graphContext)
    .size(raster.width,raster.height)
    .geometry(gpu.rectangle(raster.width,raster.height))
    .attribute('a_vertex',2,'float', 16,0)      // X, Y
    .attribute('a_texCoord',2, 'float', 16, 8)  // S, T
    .texture(gproc_threshold.framebuffers['fbo2'])
    .packWith(the_shader) // VAO
    .clearCanvas([0.0,1.0,1.0,1.0])
    .preprocess()
    .uniform('u_resolution',new Float32Array([1.0/raster.width,1.0/raster.height]))
    .uniform('u_image',0)
.run(); 


  return raster;
  
}
